"""Figures of the technical report, drawn as SVG (report palette, Cambria)."""
import html

INK, HEAD, TEAL, SOFT = "#22292d", "#2f3e46", "#4a7c76", "#eef3f2"
AMB, AMBF, LINE, MUTE = "#c8913a", "#fbf2e2", "#5b6b70", "#6b7b7f"
FONT, MONO = "Cambria,Georgia,serif", "Consolas,'Courier New',monospace"
DEFS = ('<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{LINE}"/></marker>'
        '<marker id="dm" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="14" markerHeight="9" orient="auto-start-reverse">'
        f'<path d="M1 5L8 1L15 5L8 9z" fill="{HEAD}"/></marker></defs>')


def esc(s):
    return html.escape(s, quote=False)


def svg(w, h, body):
    return (f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" font-family="{FONT}" font-size="11" '
            f'style="width:100%;height:auto">{DEFS}{"".join(body)}</svg>')


def text(x, y, t, anchor="start", size=10, color=INK, bold=False, italic=False, mono=False):
    extra = (' font-weight="700"' if bold else "") + (' font-style="italic"' if italic else "")
    fam = f' font-family="{MONO}"' if mono else ""
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" fill="{color}"{extra}{fam}>{esc(t)}</text>'


def box(x, y, w, title, lines=(), kind="det", h=None):
    fill, stroke = {"det": (SOFT, TEAL), "ai": (AMBF, AMB), "plain": ("#ffffff", LINE), "ext": ("#ffffff", LINE),
                    "accent": ("#dde9e6", TEAL)}[kind]
    hh = h or (26 + 14 * len(lines) + (6 if lines else 0))
    dash = ' stroke-dasharray="4 3"' if kind == "ext" else ""
    width = "1.8" if kind == "accent" else "1.2"
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{hh}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="{width}"{dash}/>',
           text(x + w / 2, y + 17, title, "middle", 11.5, HEAD, bold=True)]
    out += [text(x + w / 2, y + 33 + 14 * i, l, "middle", 10) for i, l in enumerate(lines)]
    return "".join(out), hh


def path(d, dashed=False, end=True, start=False):
    a = ' stroke-dasharray="4 3"' if dashed else ""
    a += ' marker-end="url(#ar)"' if end else ""
    a += ' marker-start="url(#dm)"' if start else ""
    return f'<path d="{d}" fill="none" stroke="{LINE}" stroke-width="1.1"{a}/>'


def lab(x, y, t, anchor="start"):
    return text(x, y, t, anchor, 9.5, MUTE, italic=True)


def mult(x, y, t, anchor="start"):
    return text(x, y, t, anchor, 9.5, HEAD, bold=True)


def uml(x, y, w, name, attrs):
    h = 32 + 13 * len(attrs) if attrs else 26
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#ffffff" stroke="{HEAD}" stroke-width="1.2"/>',
           f'<rect x="{x}" y="{y}" width="{w}" height="24" fill="{SOFT}" stroke="{HEAD}" stroke-width="1.2"/>',
           text(x + w / 2, y + 16, name, "middle", 11, HEAD, bold=True)]
    out += [text(x + 8, y + 38 + 13 * i, a, "start", 9.2, INK, mono=True) for i, a in enumerate(attrs)]
    return "".join(out), h


# ─── 1.1 The five phases ──────────────────────────────────────────
def phases():
    data = [("1. Préparation", ["maîtrise documentaire", "exigences, périmètre", "politique de sécurité"]),
            ("2. Risques", ["méthodologie", "registre des risques", "SoA, plan de traitement"]),
            ("3. Documentation", ["politiques et", "procédures issues", "de la SoA"]),
            ("4. Audit et revue", ["formations, objectifs", "audit interne", "revue de direction"]),
            ("5. Maintenance", ["activités récurrentes", "programme d'audit", "certification"])]
    body, w, gap = [], 128, 20
    for i, (t, ls) in enumerate(data):
        s, h = box(i * (w + gap), 10, w, t, ls)
        body.append(s)
        if i < 4:
            body.append(path(f"M{i * (w + gap) + w} 52H{(i + 1) * (w + gap)}"))
    s, _ = box(0, 130, 720, "Socle commun", ["bibliothèque documentaire versionnée · tâches et notifications · assistant IA · journal d'audit"], "plain")
    body.append(s)
    for i in range(5):
        body.append(path(f"M{i * (w + gap) + w / 2} 104V130", dashed=True, end=False))
    return svg(720, 180, body)


# ─── 2.1 Architecture ─────────────────────────────────────────────
def architecture():
    b = []
    for args in [(230, 10, 260, "Frontend Next.js 15 (:3000)", ["React 19, Tailwind CSS 4", "exécuté dans le navigateur"], "det"),
                 (180, 120, 360, "Backend NestJS 11 (:4000, /api/v1)", ["authentification, rôles, règles ISO 27001", "Prisma, tâches planifiées, e-mails", "seul accès aux données métier"], "accent"),
                 (10, 250, 200, "PostgreSQL « aptiso »", ["base métier (66 modèles)"], "plain"),
                 (260, 250, 180, "SMTP", ["e-mails Handlebars"], "ext"),
                 (490, 250, 220, "Service IA FastAPI", ["127.0.0.1:8000, jeton de service", "validation, RAG, flux SSE"], "ai"),
                 (10, 380, 200, "API NVIDIA Build", ["LLM, embeddings, OCR"], "ext"),
                 (260, 380, 180, "Redis + worker arq", ["traitements longs"], "ai"),
                 (490, 380, 220, "PostgreSQL « aptiso_ai »", ["pgvector · ai_runs · ai_jobs", "knowledge_chunks"], "plain")]:
        b.append(box(*args)[0])
    b += [path("M360 70V120"), lab(368, 99, "REST JSON + SSE, cookies HttpOnly"),
          path("M250 194V222H110V250"), lab(118, 242, "Prisma"),
          path("M350 194V250"), lab(358, 232, "SMTP/TLS"),
          path("M470 194V222H600V250"), lab(608, 242, "HTTP + jeton"),
          path("M650 310V380"), lab(658, 350, "SQL"),
          path("M540 310V346H350V380"), lab(445, 340, "file de jobs", "middle"),
          path("M490 304H110V380"), lab(300, 320, "HTTPS (SDK OpenAI)", "middle")]
    lx = 10
    for kind, t in [("det", "code APTISO (TypeScript)"), ("ai", "service IA (Python)"), ("plain", "donnée"), ("ext", "service externe")]:
        fill, stroke = {"det": (SOFT, TEAL), "ai": (AMBF, AMB), "plain": ("#fff", LINE), "ext": ("#fff", LINE)}[kind]
        dash = ' stroke-dasharray="3 2"' if kind == "ext" else ""
        b.append(f'<rect x="{lx}" y="452" width="14" height="10" rx="2" fill="{fill}" stroke="{stroke}"{dash}/>')
        b.append(text(lx + 20, 461, t, size=9.5, color=MUTE))
        lx += 175
    return svg(720, 472, b)


# ─── 3.x Class diagrams ───────────────────────────────────────────
def class_core():
    yA, yB, yC, yD = 10, 179, 309, 452
    b = []
    for a in [(10, yA, 200, "User", ["email : String", "first_name, last_name", "password_hash : String", "is_email_verified : Boolean", "totp_secret : String? (chiffré)", "email_notifications : Boolean", "weekly_digest : Boolean"]),
              (260, yA, 180, "OrganizationMember", ["role : OrganizationRole"]),
              (490, yA, 220, "Organization", ["name : String", "industry : String?", "description : String?"]),
              (10, yB, 200, "ProjectMember", ["privilege : ProjectRole", "custom_role : String?"]),
              (490, yB, 220, "ComplianceProject", ["name : String", "status : ProjectStatus", "start_date, target_date", "description : String?"]),
              (10, yC, 200, "ProjectMemberIsoRole", ["iso_role : IsoRole"]),
              (260, yC, 180, "TaskAssignment", ["type : TaskType", "status : TaskStatus", "deadline : DateTime?", "completed_at : DateTime?", "activity_key : String?"]),
              (490, yC, 220, "ProjectPhase", ["name : String", "order : Int (1 à 5)", "description : String?"]),
              (10, yD, 200, "DocumentVersion", ["version : String", "published_at : DateTime", "approved_by : UUID?", "pdf_data : Bytes?", "notes : String?"]),
              (260, yD, 180, "DocumentInstance", ["title : String", "status : DocumentStatus", "content : Json (Tiptap)", "code, confidentiality", "owner_id, approver_id", "update_interval : Int?"]),
              (490, yD, 220, "ProjectStep", ["key : String", "title : String", "type : StepType", "status : StepStatus", "order : Int", "metadata_json : Json?"])]:
        b.append(uml(*a)[0])
    b += [path(f"M210 {yA + 30}H260", end=False), mult(214, yA + 26, "1"), mult(256, yA + 26, "*", "end"),
          path(f"M440 {yA + 30}H490", end=False), mult(444, yA + 26, "*"), mult(486, yA + 26, "1", "end"),
          path(f"M600 {yA + 71}V{yB}", end=False, start=True), mult(606, yB - 6, "*"),
          path(f"M110 {yA + 123}V{yB}", end=False), mult(116, yA + 136, "1"), mult(116, yB - 6, "*"),
          path(f"M210 {yB + 30}H490", end=False), mult(214, yB + 26, "*"), mult(486, yB + 26, "1", "end"), lab(350, yB + 25, "membre de", "middle"),
          path(f"M110 {yB + 58}V{yC}", end=False, start=True), mult(116, yC - 6, "0..*"),
          path(f"M600 {yB + 84}V{yC}", end=False, start=True), mult(606, yC - 6, "5"),
          path(f"M600 {yC + 71}V{yD}", end=False, start=True), mult(606, yD - 6, "1..*"),
          path(f"M490 {yD + 30}H440", end=False), mult(486, yD + 26, "1", "end"), mult(444, yD + 26, "0..1"),
          path(f"M260 {yD + 30}H210", end=False, start=True), mult(214, yD + 26, "0..*"),
          path(f"M380 {yC}V{yB + 70}H490", end=False), mult(386, yC - 6, "*"), mult(486, yB + 66, "1", "end"),
          path(f"M350 {yC + 97}V{yD}", end=False), mult(356, yC + 110, "*"), mult(356, yD - 6, "0..1")]
    return svg(720, yD + 120, b)


def class_risk():
    yA, yB, yC = 10, 166, 322
    b = []
    for a in [(10, yA, 200, "Requirement", ["requirement_type : enum", "status : ComplianceStatus", "interested_party : String", "description : String", "deadline : DateTime?"]),
              (260, yA, 180, "ProjectStep", ["key : String", "type : StepType"]),
              (490, yA, 220, "SoaControl", ["applicable : Boolean?", "justification : String?", "status : enum (IMPLEMENTED…)", "responsible_id : UUID?", "deadline : DateTime?", "resources_decision : enum?"]),
              (10, yB, 200, "RiskAsset", ["name : String", "category : AssetCategory"]),
              (250, yB, 200, "RiskItem", ["impact, likelihood : 0..2", "level : 0..4 (somme)", "acceptability : enum", "treatment_option : enum", "residual_risk : Int?", "approval_decision : enum"]),
              (490, yB, 220, "RiskControl", ["code : String (A.5.1…A.8.34)", "title : String"]),
              (10, yC, 200, "RiskVulnerability", ["name : String", "category : AssetCategory"]),
              (490, yC, 220, "RiskThreat", ["name : String", "threat_category : enum"])]:
        b.append(uml(*a)[0])
    b += [path(f"M260 {yA + 30}H210", end=False, start=True), mult(214, yA + 26, "0..*"),
          path(f"M440 {yA + 30}H490", end=False, start=True), mult(486, yA + 26, "93", "end"),
          path(f"M350 {yA + 58}V{yB}", end=False, start=True), mult(356, yB - 6, "0..*"),
          path(f"M250 {yB + 30}H210", end=False), mult(246, yB + 26, "*", "end"), mult(214, yB + 26, "1"),
          path(f"M450 {yB + 30}H490", end=False), mult(454, yB + 26, "*"), mult(486, yB + 26, "*", "end"),
          path(f"M600 {yA + 110}V{yB}", end=False), mult(606, yA + 123, "*"), mult(606, yB - 6, "1"),
          path(f"M300 {yB + 110}V{yC + 29}H210", end=False), mult(306, yB + 123, "*"), mult(214, yC + 25, "1"),
          path(f"M400 {yB + 110}V{yC + 29}H490", end=False), mult(406, yB + 123, "*"), mult(486, yC + 25, "1", "end")]
    return svg(720, yC + 68, b)


def class_improvement():
    yA, yB, yC = 10, 153, 309
    b = []
    for a in [(10, yA, 200, "InternalAudit", ["title : String", "status : AuditStatus", "start_date, end_date", "lead_auditor_id : UUID", "conclusion : String?"]),
              (260, yA, 180, "ComplianceProject", ["name : String", "status : ProjectStatus"]),
              (490, yA, 220, "ManagementReview", ["review_date : DateTime", "status : enum", "conclusions : String?", "completed_at : DateTime?"]),
              (10, yB, 200, "AuditChecklistItem", ["ref : String (4.1, A.5.1…)", "result : AuditResult?", "evidence : String?"]),
              (260, yB, 180, "Nonconformity", ["number : Int", "title : String", "source : enum", "status : enum", "root_cause : String?", "correction : String?"]),
              (490, yB, 220, "ManagementReviewDecision", ["type : ReviewDecisionType", "description : String", "responsible_id, due_date"]),
              (260, yC, 180, "CorrectiveAction", ["description : String", "responsible_id : UUID", "due_date : DateTime?", "status : ActionStatus"]),
              (490, yC, 220, "Incident", ["title : String", "severity : enum", "occurred_at : DateTime", "is_security_incident", "status : enum"])]:
        b.append(uml(*a)[0])
    b += [path(f"M260 {yA + 30}H210", end=False, start=True), mult(214, yA + 26, "0..*"),
          path(f"M440 {yA + 30}H490", end=False, start=True), mult(486, yA + 26, "0..*", "end"),
          path(f"M350 {yA + 58}V{yB}", end=False, start=True), mult(356, yB - 6, "0..*"),
          path(f"M110 {yA + 97}V{yB}", end=False, start=True), mult(116, yB - 6, "*"),
          path(f"M210 {yB + 30}H260", end=False), mult(214, yB + 26, "0..1"), mult(256, yB + 26, "0..1", "end"),
          path(f"M600 {yA + 84}V{yB}", end=False, start=True), mult(606, yB - 6, "*"),
          path(f"M350 {yB + 110}V{yC}", end=False, start=True), mult(356, yC - 6, "0..*"),
          path(f"M490 {yC + 30}H470V{yB + 90}H440", end=False), mult(486, yC + 26, "0..1", "end"), mult(444, yB + 86, "0..*")]
    return svg(720, yC + 107, b)


def class_ai():
    yA, yB, yC = 10, 114, 231
    b = []
    for a in [(10, yA, 200, "User", ["email : String", "first_name : String"]),
              (260, yA, 180, "AiConversation", ["title : String(120)", "updated_at : DateTime"]),
              (490, yA, 220, "ComplianceProject", ["name : String"]),
              (10, yB, 200, "Notification", ["type : NotificationType", "read_at : DateTime?", "actor_id : UUID?"]),
              (260, yB, 180, "AiMessage", ["role : user | assistant", "content : Text", "citations : Json?"]),
              (490, yB, 220, "DocumentInstance", ["title : String", "status : DocumentStatus"]),
              (260, yC, 180, "AiReviewFinding", ["type, ref : String", "severity : String", "quote : String?", "explanation, suggestion", "state : AiFindingState"]),
              (490, yC, 220, "DocumentAiReview", ["status : AiJobStatus", "content_hash : String", "job_id, run_id", "completed_at : DateTime?"])]:
        b.append(uml(*a)[0])
    b += [path(f"M210 {yA + 30}H260", end=False), mult(214, yA + 26, "1"), mult(256, yA + 26, "*", "end"),
          path(f"M490 {yA + 30}H440", end=False), mult(486, yA + 26, "1", "end"), mult(444, yA + 26, "*"),
          path(f"M350 {yA + 58}V{yB}", end=False, start=True), mult(356, yB - 6, "*"),
          path(f"M110 {yA + 58}V{yB}", end=False), mult(116, yA + 71, "1"), mult(116, yB - 6, "*"),
          path(f"M600 {yA + 45}V{yB}", dashed=True, end=False), lab(606, yA + 80, "via ProjectStep"),
          path(f"M600 {yB + 58}V{yC}", end=False, start=True), mult(606, yC - 6, "0..*"),
          path(f"M490 {yC + 30}H440", end=False, start=True), mult(444, yC + 26, "*")]
    return svg(720, yC + 107, b)


# ─── 4.x Backend ──────────────────────────────────────────────────
def request_pipeline():
    steps = [("Middlewares", ["helmet, cookies,", "CORS"]), ("Guards", ["CSRF, JWT, rôles,", "limite de débit"]),
             ("Validation", ["ValidationPipe,", "DTO (whitelist)"]), ("Contrôleur", ["route, paramètres,", "utilisateur courant"]),
             ("Service", ["droits fins,", "règles ISO 27001"]), ("Prisma", ["requêtes typées,", "transactions"])]
    b, w, gap = [], 108, 14
    for i, (t, ls) in enumerate(steps):
        b.append(box(i * (w + gap), 30, w, t, ls, "accent" if t == "Service" else "det")[0])
        if i < 5:
            b.append(path(f"M{i * (w + gap) + w} 61H{(i + 1) * (w + gap)}"))
    b.append(text(0, 18, "Requête HTTP (/api/v1/…)", size=10, color=MUTE, italic=True))
    b.append(box(366, 136, 352, "PrismaExceptionFilter → réponse HTTP", ["doublon → 409, introuvable → 404, sinon erreur métier"], "plain")[0])
    b.append(path("M542 92V136"))
    b.append(path("M664 92V114H542", end=False))
    b.append(lab(372, 128, "erreur levée"))
    return svg(720, 186, b)


def document_states():
    b = []
    y, w = 90, 150
    xs = {"draft": 40, "review": 290, "pub": 530}
    for k, t, ls in [("draft", "Brouillon", ["DRAFT"]), ("review", "En approbation", ["IN_REVIEW, verrouillé"]), ("pub", "Publié", ["PUBLISHED, version x.y"])]:
        b.append(box(xs[k], y, w, t, ls, "accent" if k == "pub" else "det")[0])
    b += [f'<circle cx="10" cy="{y + 23}" r="5" fill="{HEAD}"/>', path(f"M15 {y + 23}H40"),
          path(f"M190 {y + 16}H290"), lab(240, y + 10, "soumission", "middle"),
          path(f"M290 {y + 32}H190"), lab(240, y + 48, "modifications / retrait", "middle"),
          path(f"M440 {y + 23}H530"), lab(485, y + 17, "approbation", "middle"),
          path(f"M115 {y}V40H605V{y}"), lab(360, 34, "soumission par le responsable, sans approbateur", "middle"),
          path(f"M605 {y + 46}V176H115V{y + 46}"), lab(360, 192, "modification d'un document publié : nouvelle révision (1.0 → 1.1)", "middle"),
          text(530, y + 70, "chaque publication crée une DocumentVersion + PDF", size=9.5, color=MUTE)]
    return svg(720, 204, b)


# ─── 6.x AI ───────────────────────────────────────────────────────
def structured_output():
    b = []
    for args in [(0, 50, 120, "Invite", ["versionnée, données", "balisées"], "det"),
                 (150, 50, 120, "Modèle", ["capacité, modèle", "de secours"], "ai"),
                 (300, 50, 120, "Réparation", ["JSON partiel", "ou entouré"], "det"),
                 (450, 50, 120, "Validation", ["schéma Pydantic +", "contrôles métier"], "det"),
                 (600, 150, 120, "Accepté", ["journal ai_runs,", "décision humaine"], "accent"),
                 (340, 150, 220, "Rejeté", ["le backend applique le", "comportement sans IA"], "plain")]:
        b.append(box(*args)[0])
    b += [path("M120 80H150"), path("M270 80H300"), path("M420 80H450"), path("M570 80H585"),
          f'<polygon points="585,80 640,50 695,80 640,110" fill="#fff" stroke="{HEAD}" stroke-width="1.2"/>',
          text(640, 84, "valide ?", "middle", 10.5, HEAD, bold=True),
          path("M640 50V22H210V50"), lab(425, 16, "non, 1re fois : nouvel essai avec la liste exacte des erreurs", "middle"),
          path("M695 80V150"), lab(702, 120, "oui"),
          path("M640 110V130H520V150"), lab(580, 125, "non, 2e fois", "middle")]
    return svg(720, 212, b)


def rag():
    b = []
    for args in [(0, 85, 110, "Question", ["+ question", "précédente"], "det"),
                 (150, 20, 160, "Embedding", ["vecteur 2048 dimensions"], "ai"),
                 (340, 20, 170, "Proximité vectorielle", ["index HNSW, cosinus"], "plain"),
                 (150, 160, 160, "Requête plein texte", ["tsquery"], "det"),
                 (340, 160, 170, "Classement", ["ts_rank sur tsvector"], "plain"),
                 (550, 85, 170, "Fusion RRF (k = 60)", ["filtre projet + visibilité", "≤ 12 passages S1…"], "accent")]:
        b.append(box(*args)[0])
    b += [path("M110 108H130V43H150"), path("M110 120H130V183H150"),
          path("M310 43H340"), path("M310 183H340"),
          path("M510 43H530V108H550"), path("M510 183H530V120H550")]
    return svg(720, 212, b)


# ─── sequences ────────────────────────────────────────────────────
def sequence(lanes, msgs, top=70, step=32):
    b = []
    h = top + step * len(msgs) + 16
    for name, x, kind in lanes:
        w = 130
        b.append(box(x - w / 2, 6, w, name, (), kind, h=30)[0])
        b.append(f'<line x1="{x}" y1="36" x2="{x}" y2="{h - 6}" stroke="#c7d0d0" stroke-width="1.1" stroke-dasharray="3 4"/>')
    for i, (a, c, t, kind) in enumerate(msgs):
        y = top + step * i
        xa, xc = lanes[a][1], lanes[c][1]
        if kind == "self" and xa > 560:  # last lane: loop and words on the left
            b.append(path(f"M{xa} {y - 6}H{xa - 26}V{y + 6}H{xa - 3}"))
            b.append(text(xa - 32, y + 4, f"{i + 1}. {t}", "end", 9.8, MUTE))
        elif kind == "self":
            b.append(path(f"M{xa} {y - 6}H{xa + 26}V{y + 6}H{xa + 3}"))
            b.append(text(xa + 32, y + 4, f"{i + 1}. {t}", size=9.8, color=MUTE))
        else:
            b.append(path(f"M{xa} {y}H{xc}", dashed=(kind == "ret")))
            b.append(text((xa + xc) / 2, y - 5, f"{i + 1}. {t}", "middle", 9.8, INK if kind == "call" else MUTE))
    return svg(720, h, b)


def seq_chat():
    lanes = [("Navigateur", 80, "det"), ("Backend", 300, "accent"), ("Service IA", 510, "ai"), ("NVIDIA", 655, "ext")]
    msgs = [(0, 1, "POST /projects/:id/ai/chat", "call"), (1, 1, "droits, conversation, historique", "self"),
            (1, 2, "POST /v1/search", "call"), (2, 1, "passages (RAG hybride)", "ret"),
            (1, 1, "faits du projet + progression", "self"), (1, 2, "POST /v1/chat", "call"),
            (2, 3, "génération en flux", "call"), (3, 2, "jetons", "ret"),
            (2, 1, "SSE : delta, citations, done", "ret"), (1, 0, "SSE relayé + conversation", "ret"),
            (1, 1, "réponse enregistrée (AiMessage)", "self")]
    return sequence(lanes, msgs)


def seq_login():
    lanes = [("Navigateur", 90, "det"), ("Backend", 360, "accent"), ("Base métier", 620, "plain")]
    msgs = [(0, 1, "POST /auth/login {email, mot de passe}", "call"), (1, 2, "utilisateur, empreinte Argon2", "call"),
            (2, 1, "compte actif, 2FA activée", "ret"), (1, 0, "200 {two_factor_required, challenge_token}", "ret"),
            (0, 1, "POST /auth/login/2fa {challenge_token, code}", "call"), (1, 1, "jeton de défi valide (5 min)", "self"),
            (1, 2, "code TOTP (±1 pas), non rejoué", "call"), (1, 2, "totp_last_step, nouvelle session", "call"),
            (1, 0, "cookies HttpOnly (accès + rafraîchissement)", "ret")]
    return sequence(lanes, msgs)


def seq_job():
    lanes = [("Navigateur", 70, "det"), ("Backend", 250, "accent"), ("Service IA", 430, "ai"), ("Redis + worker", 620, "ai")]
    msgs = [(0, 1, "demande de revue", "call"), (1, 2, "POST /v1/jobs (clé d'idempotence)", "call"),
            (2, 3, "mise en file", "call"), (2, 1, "202 Accepted {job_id}", "ret"),
            (3, 3, "revue, validation, 3 essais max", "self"), (0, 1, "interrogation périodique", "call"),
            (1, 2, "GET /v1/jobs/{id}", "call"), (2, 1, "DONE + constats validés", "ret"),
            (1, 1, "constats enregistrés", "self")]
    return sequence(lanes, msgs)


# ─── 8.1 Deployment ───────────────────────────────────────────────
def deployment():
    b = [f'<rect x="130" y="10" width="440" height="335" rx="8" fill="#fbfcfc" stroke="{HEAD}" stroke-width="1.2"/>',
         text(142, 28, "Machine de développement", size=10.5, color=HEAD, bold=True),
         f'<rect x="150" y="120" width="400" height="210" rx="8" fill="none" stroke="{TEAL}" stroke-width="1.2" stroke-dasharray="5 3"/>',
         text(270, 138, "Docker Compose", size=10, color=TEAL, bold=True)]
    for args in [(0, 40, 100, "Navigateur", (), "plain", 46),
                 (150, 40, 400, "Processus Node.js (npm run dev)", ["Next.js :3000  ·  NestJS :4000"], "det", 46),
                 (166, 150, 180, "postgres", ["pgvector:0.8.0-pg16", "aptiso · aptiso_ai", "volume nommé"], "plain", None),
                 (366, 150, 170, "ai", ["127.0.0.1:8000", "alembic + uvicorn"], "ai", None),
                 (166, 250, 180, "ai-worker", ["arq WorkerSettings"], "ai", None),
                 (366, 250, 170, "redis", ["7.4-alpine", "volume nommé"], "plain", None),
                 (600, 40, 120, "SMTP", ["Gmail, TLS 465"], "ext", None),
                 (600, 150, 120, "API NVIDIA", ["build.nvidia.com"], "ext", None)]:
        b.append(box(*args)[0])
    b += [path("M100 63H150"), path("M256 86V150"), lab(262, 112, "5432"),
          path("M451 86V150"), lab(457, 112, "8000"),
          path("M366 180H346"), path("M451 210V250"), lab(457, 234, "file"),
          path("M346 270H366"), path("M256 250V224"),
          path("M536 175H600"), path("M550 63H600")]
    return svg(720, 352, b)


FIGS = {"phases": phases, "architecture": architecture, "class_core": class_core, "class_risk": class_risk,
        "class_improvement": class_improvement, "class_ai": class_ai, "request_pipeline": request_pipeline,
        "document_states": document_states, "structured_output": structured_output, "rag": rag,
        "seq_chat": seq_chat, "seq_login": seq_login, "seq_job": seq_job, "deployment": deployment}
