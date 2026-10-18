import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type { ProseMirrorNode } from './templates/doc-control.template';

/** Identification printed on every page (clause 7.5.2: title, version, date and approval). */
export interface PdfMeta {
  title: string;
  organization: string;
  version: string;
  publishedAt: Date;
  approvedBy: string;
}

interface Run { text: string; bold?: boolean; italic?: boolean }
interface Segment { text: string; font: PDFFont }
type Line = Segment[];

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = { left: 56, right: 56, top: 72, bottom: 64 };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const BODY_SIZE = 10.5;
const CELL_SIZE = 9;
const CELL_PAD = 4;
const LIST_INDENT = 16;
const GREY = rgb(0.4, 0.4, 0.4);
const BORDER = rgb(0.6, 0.6, 0.6);
const HEADER_FILL = rgb(0.9, 0.92, 0.96);

// DejaVu covers Latin, Greek, Cyrillic, arrows, maths and check marks, so user text never breaks publishing.
const FONT_DIR = join(dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf');
const FONT_FILES = {
  normal: 'DejaVuSans.ttf',
  bold: 'DejaVuSans-Bold.ttf',
  italic: 'DejaVuSans-Oblique.ttf',
  boldItalic: 'DejaVuSans-BoldOblique.ttf',
} as const;
type FontKey = keyof typeof FONT_FILES;
let fontBytes: Record<FontKey, Buffer> | null = null;
const loadFontBytes = () =>
  (fontBytes ??= Object.fromEntries(
    Object.entries(FONT_FILES).map(([k, f]) => [k, readFileSync(join(FONT_DIR, f))]),
  ) as Record<FontKey, Buffer>);

/** Renders a ProseMirror document to an A4 PDF with a running header and footer. */
export async function renderPdf(content: ProseMirrorNode, meta: PdfMeta): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(meta.title);
  pdf.setAuthor(meta.organization);
  const bytes = loadFontBytes();
  const fonts = {} as Record<FontKey, PDFFont>;
  for (const key of Object.keys(FONT_FILES) as FontKey[]) {
    fonts[key] = await pdf.embedFont(bytes[key], { subset: true });
  }

  const writer = new PdfWriter(pdf, fonts);
  writer.block(content);
  writer.decoratePages(meta);
  return pdf.save();
}

class PdfWriter {
  private page: PDFPage;
  private y = 0;

  constructor(private readonly pdf: PDFDocument, private readonly fonts: Record<FontKey, PDFFont>) {
    this.page = this.newPage();
  }

  block(node: ProseMirrorNode, indent = 0): void {
    switch (node.type) {
      case 'heading': {
        const level = Number(node.attrs?.level ?? 1);
        const size = level === 1 ? 17 : level === 2 ? 13.5 : 11.5;
        this.y -= level === 1 ? 10 : 8;
        const lines = this.wrap(runsOf(node).map(r => ({ ...r, bold: true })), size, CONTENT_WIDTH - indent);
        this.ensure(lines.length * lineHeight(size) + 3 * lineHeight(BODY_SIZE)); // keep the heading with what follows
        this.drawLines(lines, MARGIN.left + indent, size);
        this.y -= 4;
        return;
      }
      case 'paragraph': {
        const runs = runsOf(node);
        if (!runs.some(r => r.text.trim())) { this.y -= lineHeight(BODY_SIZE) / 2; return; }
        this.drawLines(this.wrap(runs, BODY_SIZE, CONTENT_WIDTH - indent), MARGIN.left + indent, BODY_SIZE);
        this.y -= 5;
        return;
      }
      case 'bulletList':
      case 'orderedList':
        (node.content ?? []).forEach((item, i) => this.listItem(item, node.type === 'bulletList' ? '•' : `${i + 1}.`, indent));
        this.y -= 3;
        return;
      case 'table':
        this.table(node);
        return;
      case 'horizontalRule':
        this.ensure(12);
        this.page.drawLine({ start: { x: MARGIN.left, y: this.y - 4 }, end: { x: PAGE.width - MARGIN.right, y: this.y - 4 }, thickness: 0.5, color: BORDER });
        this.y -= 12;
        return;
      default:
        (node.content ?? []).forEach(child => this.block(child, indent));
    }
  }

  private listItem(item: ProseMirrorNode, marker: string, indent: number) {
    const textIndent = indent + LIST_INDENT;
    (item.content ?? []).forEach((child, i) => {
      if (i === 0 && child.type === 'paragraph') {
        const lines = this.wrap(runsOf(child), BODY_SIZE, CONTENT_WIDTH - textIndent);
        this.ensure(lineHeight(BODY_SIZE));
        this.page.drawText(marker, { x: MARGIN.left + indent + 2, y: this.y - BODY_SIZE, size: BODY_SIZE, font: this.fonts.normal });
        this.drawLines(lines, MARGIN.left + textIndent, BODY_SIZE);
        this.y -= 2;
      } else {
        this.block(child, textIndent);
      }
    });
  }

  /** Tables wrap every cell in full; rows that do not fit continue on the next page under a repeated header. */
  private table(node: ProseMirrorNode) {
    const rows = (node.content ?? []).filter(r => r.type === 'tableRow').map(r =>
      (r.content ?? []).map(c => ({ header: c.type === 'tableHeader', runs: cellRuns(c) })));
    if (!rows.length) return;
    const cols = Math.max(...rows.map(r => r.length));
    const weights = Array.from({ length: cols }, (_, c) =>
      Math.sqrt(Math.max(4, ...rows.map(r => Math.min(60, (r[c]?.runs ?? []).reduce((n, run) => n + run.text.length, 0))))));
    const total = weights.reduce((a, b) => a + b, 0);
    const widths = weights.map(w => (CONTENT_WIDTH * w) / total);
    const lh = lineHeight(CELL_SIZE);

    const layout = (row: typeof rows[number]) => widths.map((w, c) => {
      const cell = row[c];
      return cell ? this.wrap(cell.header ? cell.runs.map(r => ({ ...r, bold: true })) : cell.runs, CELL_SIZE, w - 2 * CELL_PAD) : [];
    });
    const headerRow = rows[0].every(c => c.header) ? rows[0] : null;

    const drawChunk = (cells: Line[][], shaded: boolean) => {
      const height = Math.max(1, ...cells.map(l => l.length)) * lh + 2 * CELL_PAD;
      let x = MARGIN.left;
      cells.forEach((lines, c) => {
        this.page.drawRectangle({ x, y: this.y - height, width: widths[c], height, borderColor: BORDER, borderWidth: 0.5, ...(shaded && { color: HEADER_FILL }) });
        let ly = this.y - CELL_PAD - CELL_SIZE;
        for (const line of lines) { this.drawLine(line, x + CELL_PAD, ly, CELL_SIZE); ly -= lh; }
        x += widths[c];
      });
      this.y -= height;
    };

    this.y -= 4;
    rows.forEach((row, ri) => {
      const isHeader = row === headerRow;
      let pending = layout(row);
      while (pending.some(l => l.length)) {
        const fit = Math.floor((this.y - MARGIN.bottom - 2 * CELL_PAD) / lh);
        if (fit < 2) {
          this.newPage();
          if (headerRow && !isHeader && ri > 0) drawChunk(layout(headerRow), true);
          continue;
        }
        drawChunk(pending.map(l => l.slice(0, fit)), isHeader);
        pending = pending.map(l => l.slice(fit));
      }
    });
    this.y -= 10;
  }

  /** Header and footer on every page; done last so the footer can show the page count. */
  decoratePages(meta: PdfMeta) {
    const pages = this.pdf.getPages();
    const date = meta.publishedAt.toLocaleDateString('en-GB');
    pages.forEach((page, i) => {
      const top = PAGE.height - MARGIN.top + 28;
      this.drawEdge(page, meta.title, meta.organization, top);
      page.drawLine({ start: { x: MARGIN.left, y: top - 6 }, end: { x: PAGE.width - MARGIN.right, y: top - 6 }, thickness: 0.5, color: BORDER });
      this.drawEdge(page, `Version ${meta.version} · Approved by ${meta.approvedBy} on ${date}`, `Page ${i + 1} of ${pages.length}`, MARGIN.bottom - 30);
    });
  }

  private drawEdge(page: PDFPage, left: string, right: string, y: number) {
    const size = 8;
    const font = this.fonts.normal;
    const rightWidth = font.widthOfTextAtSize(right, size);
    page.drawText(this.truncate(left, size, CONTENT_WIDTH - rightWidth - 16), { x: MARGIN.left, y, size, font, color: GREY });
    page.drawText(right, { x: PAGE.width - MARGIN.right - rightWidth, y, size, font, color: GREY });
  }

  private truncate(text: string, size: number, max: number) {
    const font = this.fonts.normal;
    if (font.widthOfTextAtSize(text, size) <= max) return text;
    let t = text;
    while (t && font.widthOfTextAtSize(`${t}…`, size) > max) t = t.slice(0, -1);
    return `${t}…`;
  }

  // ─── Text layout ────────────────────────────────────────────

  private font(run: Run) {
    return run.bold ? (run.italic ? this.fonts.boldItalic : this.fonts.bold) : run.italic ? this.fonts.italic : this.fonts.normal;
  }

  /** Word-wraps styled runs; "\n" forces a line break and over-long words are split. */
  private wrap(runs: Run[], size: number, maxWidth: number): Line[] {
    const lines: Line[] = [];
    let line: Line = [];
    let width = 0;
    const push = () => { lines.push(line); line = []; width = 0; };
    for (const run of runs) {
      const font = this.font(run);
      for (const token of run.text.split(/(\n|\s+)/)) {
        if (!token) continue;
        if (token === '\n') { push(); continue; }
        const isSpace = /^\s+$/.test(token);
        if (isSpace && !line.length) continue;
        let w = font.widthOfTextAtSize(token, size);
        if (!isSpace && width + w > maxWidth && line.length) push();
        let rest = token;
        while (!isSpace && w > maxWidth) {
          let n = rest.length - 1;
          while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), size) > maxWidth) n--;
          line.push({ text: rest.slice(0, n), font });
          push();
          rest = rest.slice(n);
          w = font.widthOfTextAtSize(rest, size);
        }
        line.push({ text: isSpace ? ' ' : rest, font });
        width += isSpace ? font.widthOfTextAtSize(' ', size) : w;
      }
    }
    if (line.length) push();
    return lines;
  }

  private drawLines(lines: Line[], x: number, size: number) {
    for (const line of lines) {
      this.ensure(lineHeight(size));
      this.drawLine(line, x, this.y - size, size);
      this.y -= lineHeight(size);
    }
  }

  private drawLine(line: Line, x: number, y: number, size: number) {
    let cx = x;
    for (const seg of line) {
      this.page.drawText(seg.text, { x: cx, y, size, font: seg.font });
      cx += seg.font.widthOfTextAtSize(seg.text, size);
    }
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN.bottom) this.newPage();
  }

  private newPage() {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN.top;
    return this.page;
  }
}

const lineHeight = (size: number) => size * 1.35;

function runsOf(node: ProseMirrorNode): Run[] {
  if (node.type === 'text') {
    const marks = node.marks ?? [];
    return [{ text: node.text ?? '', bold: marks.some(m => m.type === 'bold'), italic: marks.some(m => m.type === 'italic') }];
  }
  if (node.type === 'hardBreak') return [{ text: '\n' }];
  return (node.content ?? []).flatMap(runsOf);
}

/** A cell's paragraphs and list items each start on a new line. */
function cellRuns(cell: ProseMirrorNode): Run[] {
  const blocks: Run[][] = [];
  const visit = (n: ProseMirrorNode, prefix = '') => {
    if (n.type === 'paragraph' || n.type === 'heading') blocks.push([{ text: prefix }, ...runsOf(n)]);
    else if (n.type === 'listItem') (n.content ?? []).forEach((c, i) => visit(c, i === 0 ? '• ' : ''));
    else (n.content ?? []).forEach(c => visit(c));
  };
  visit(cell);
  return blocks.flatMap((b, i) => (i ? [{ text: '\n' }, ...b] : b));
}
