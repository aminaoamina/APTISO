"""Build the technical report: figures -> Chrome render -> page lookup -> sommaire -> re-render -> headers/footers.
Same pipeline as the FelCloud internship report, in French. Run: python build.py"""
import html
import os
import re
import shutil
import subprocess

import fitz

import figs

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "report.html")
TMP = os.path.join(HERE, "_build.html")
OUT = os.path.join(HERE, "APTISO_Rapport_technique.pdf")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
RIGHT_HEADER = "ASM — Rapport technique APTISO"


def roman(n):
    out = ""
    for v, s in [(10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]:
        while n >= v:
            out += s
            n -= v
    return out


def strip(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def parse(src):
    toc, lof, lot = [], [], []
    for m in re.finditer(r'<section class="(unnum[^"]*|chapter)" id="([^"]+)">(.*?)</section>', src, re.S):
        kind, sid, body = m.groups()
        title = strip(re.search(r"<h1>(.*?)</h1>", body, re.S).group(1))
        if kind.startswith("unnum"):
            toc.append(("l0", "", title, sid))
            continue
        n = re.search(r'<div class="cnum">Chapitre (\d+)</div>', body).group(1)
        toc.append(("l0", n, title, sid))
        for h in re.finditer(r'<h2 id="([^"]+)">.*?<span class="n">([\d.]+)</span>(.*?)</h2>', body, re.S):
            toc.append(("l1", h.group(2), strip(h.group(3)), h.group(1)))
    for m in re.finditer(r'§F:([\w.]+)§.*?<figcaption><b>Figure [\w.]+ :</b>(.*?)</figcaption>', src, re.S):
        lof.append((m.group(1), strip(m.group(2)).rstrip(".")))
    for m in re.finditer(r'<p class="tcap"><b>Tableau ([\w.]+) :</b>(.*?)</p>', src, re.S):
        lot.append((m.group(1), strip(m.group(2)).rstrip(".")))
    return toc, lof, lot


def row(cls, num, title, key, pages):
    numhtml = f'<span class="num">{num}</span>' if num else ""
    return (f'<div class="row {cls}"><a class="t" href="#{key.split(":")[-1]}">{numhtml}{html.escape(title)}</a>'
            f'<span class="d"></span><span class="p">{pages.get(key, "")}</span></div>')


def fill(src, pages):
    toc, lof, lot = parse(src)
    out = src.replace("<!--TOC-->", "".join(row(c, n, t, "H:" + k, pages) for c, n, t, k in toc))
    out = out.replace("<!--LOF-->", "".join(row("l1", n, t, "F:" + n, pages) for n, t in lof))
    out = out.replace("<!--LOT-->", "".join(row("l1", n, t, "T:" + n, pages) for n, t in lot))
    # A table's caption stays on the same page as the table.
    out = re.sub(r"(<p class=\"tcap\">.*?</table>)", lambda m: f"<div class=\"tw\">{m.group(1)}</div>", out, flags=re.S)
    return re.sub(r"\{\{FIG:(\w+)\}\}", lambda m: figs.FIGS[m.group(1)](), out)


def render(html_text, out_pdf):
    with open(TMP, "w", encoding="utf-8") as fh:
        fh.write(html_text)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=8000",
                    f"--print-to-pdf={out_pdf}", "file:///" + TMP.replace("\\", "/")], check=True, capture_output=True, timeout=180)


def scan(pdf):
    doc = fitz.open(pdf)
    marks = [re.findall(r"§([^§\n]+)§", p.get_text()) for p in doc]
    arabic = next(i for i, m in enumerate(marks) if "ARABIC" in m)
    disp = {i: "" if i == 0 else (roman(i) if i < arabic else str(i - arabic + 1)) for i in range(len(marks))}
    pages = {}
    for i, ms in enumerate(marks):
        for m in ms:
            if m.startswith(("H:", "F:", "T:")):
                pages.setdefault(m, disp[i])
    return doc, marks, disp, pages


def decorate(doc, marks, disp, out):
    W = doc[0].rect.width
    L, R = 24 * 72 / 25.4, W - 24 * 72 / 25.4
    font = fitz.Font(fontfile=r"C:\Windows\Fonts\cambria.ttc")
    current = None
    for i, page in enumerate(doc):
        ms = marks[i]
        starts = [m for m in ms if m.startswith(("CH:", "UN:")) or m == "FM"]
        for m in ms:
            for r in page.search_for(f"§{m}§"):
                page.add_redact_annot(r)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
        if i == 0:
            continue
        if starts:
            s = starts[0]
            if s.startswith("CH:"):
                _, n, t = s.split(":", 2)
                current = f"Chapitre {n}. {t}"
            elif s.startswith("UN:"):
                current = s[3:]
            else:
                current = "Sommaire"
        tw = fitz.TextWriter(page.rect)
        num = disp[i]
        if num:
            tw.append((W / 2 - font.text_length(num, 10) / 2, page.rect.height - 13 * 72 / 25.4), num, font=font, fontsize=10)
        if not starts and current:
            y = 16 * 72 / 25.4
            tw.append((L, y), current, font=font, fontsize=9.5)
            tw.append((R - font.text_length(RIGHT_HEADER, 9.5), y), RIGHT_HEADER, font=font, fontsize=9.5)
            page.draw_line((L, y + 4), (R, y + 4), color=(0.15, 0.15, 0.15), width=0.6)
        tw.write_text(page, color=(0.13, 0.16, 0.18))
    doc.set_metadata({"title": "APTISO — Rapport technique", "author": "Amina Bayoudh"})
    doc.save(out, garbage=4, deflate=True)


if __name__ == "__main__":
    src = open(SRC, encoding="utf-8").read()
    pages, doc = {}, None
    for it in range(5):
        pi = os.path.join(HERE, f"_pass{it}.pdf")
        render(fill(src, pages), pi)
        doc, marks, disp, new = scan(pi)
        if new == pages:
            break
        doc.close()
        pages = new
    else:
        print("WARN: page numbers did not stabilise")
    decorate(doc, marks, disp, OUT)
    print("pages:", len(doc), "->", OUT)
    shutil.copyfile(OUT, os.path.join(HERE, "..", "APTISO-Rapport-technique.pdf"))
