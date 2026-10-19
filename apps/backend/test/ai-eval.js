/*
 * AI evaluation: annotated cases run against the real stack, scored without
 * any model (fact recall, citations, refusals, invented facts, review
 * precision and recall). Results go to test/eval/results/<label>.{json,md}.
 *
 * Needs: the dev backend on :4000, the AI service, and the NovaTeck demo data.
 *   node test/ai-eval.js [--suite chat|review] [--label baseline]
 */
const fs = require('fs');
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');

const API = process.env.EVAL_API_URL || 'http://localhost:4000/api/v1';
const AI = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const AI_TOKEN = process.env.AI_SERVICE_TOKEN;
const EMAIL = process.env.EVAL_EMAIL || 'info.aptiso+amina@gmail.com';
const PASSWORD = process.env.EVAL_PASSWORD || 'NovaTeck#2026';
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
const SUITE = arg('suite');
const LABEL = arg('label') || new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const OUT = path.join(__dirname, 'eval', 'results');

const REFUSAL = /(not (in|available|recorded|specified|found|provided|mentioned|documented|stated|listed|included)|no (information|record|data|mention|details?)|does(n't| not) (say|state|mention|contain|include|specify)|cannot (find|determine|tell|see)|can't (find|determine|tell|see)|unable to|isn't (recorded|available|stated|documented)|is not (recorded|available|stated|documented)|unknown|don't have|do not have|(have|has) not (been )?(selected|chosen|decided|bought|specified)|not (yet )?(selected|chosen|decided)|no [a-z ]{0,30}(is|are|was|were) (recorded|specified|documented|mentioned|named))/i;
const has = (text, alt) => text.toLowerCase().includes(alt.toLowerCase());
const pct = x => `${Math.round(x * 100)}%`;
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };

function sse(text) {
  const out = { answer: '', citations: [], done: null, error: null, conversation: null };
  for (const block of text.split('\n\n')) {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!event || !data) continue;
    const d = JSON.parse(data);
    if (event === 'delta') out.answer += d.text;
    else if (event === 'citations') out.citations = d;
    else if (event === 'done') out.done = d;
    else if (event === 'error') out.error = d.message;
    else if (event === 'conversation') out.conversation = d.id;
  }
  return out;
}

function scoreChat(c, r) {
  const text = r.answer;
  const groups = c.expect ?? [];
  const found = groups.filter(g => g.some(alt => has(text, alt)));
  let recall = groups.length ? found.length / groups.length : 1;
  let minOk = true;
  if (c.min) {
    const hits = c.min.any.filter(a => has(text, a)).length;
    minOk = hits >= c.min.n;
    recall = groups.length ? (found.length + (minOk ? 1 : 0)) / (groups.length + 1) : (minOk ? 1 : hits / c.min.n);
  }
  const invented = (c.forbid ?? []).filter(f => new RegExp(f, 'i').test(text));
  const cited = r.citations.length > 0;
  const refused = REFUSAL.test(text);
  const ok = !r.error && recall === 1 && minOk && invented.length === 0 && (!c.cite || cited) && (!c.refusal || refused);
  return { recall, cited, refused, invented, ok };
}

async function login() {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!res.ok) throw new Error(`login failed (${res.status}): is the backend running and NovaTeck seeded?`);
  return res.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
}

async function runChat(projectId, cookie) {
  const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval', 'chat.json'), 'utf8'));
  const rows = [];
  for (const c of cases) {
    const t0 = Date.now();
    let r;
    try {
      const res = await fetch(`${API}/projects/${projectId}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ message: c.q }), signal: AbortSignal.timeout(150_000) });
      r = res.ok ? sse(await res.text()) : { answer: '', citations: [], error: `HTTP ${res.status}` };
    } catch (e) {
      r = { answer: '', citations: [], error: e.message };
    }
    const ms = Date.now() - t0;
    // The evaluation leaves no conversation in the user's history.
    if (r.conversation) await fetch(`${API}/projects/${projectId}/ai/conversations/${r.conversation}`, { method: 'DELETE', headers: { Cookie: cookie } }).catch(() => undefined);
    const s = scoreChat(c, r);
    rows.push({ id: c.id, kind: c.kind, q: c.q, ms, ...s, error: r.error ?? null, answer: r.answer, citations: r.citations.map(x => `${x.id} ${x.title}`) });
    console.log(`${s.ok ? 'PASS' : 'FAIL'}  chat ${c.id} (${(ms / 1000).toFixed(1)} s)${s.invented.length ? '  invented!' : ''}${r.error ? `  ${r.error}` : ''}`);
  }
  return chatSummary(rows, cases);
}

/** Scores saved answers again with the current cases (no model call): runs stay comparable when a case is corrected. */
function rescoreChat(saved) {
  const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval', 'chat.json'), 'utf8'));
  const rows = saved.rows.map(row => {
    const c = cases.find(x => x.id === row.id);
    return { ...row, ...scoreChat(c, { answer: row.answer, citations: row.citations, error: row.error }) };
  });
  return chatSummary(rows, cases);
}

function chatSummary(rows, cases) {
  const by = k => rows.filter(r => r.kind === k);
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  const citeCases = cases.filter(c => c.cite).map(c => rows.find(r => r.id === c.id));
  return {
    rows,
    summary: {
      cases: rows.length, passed: rows.filter(r => r.ok).length,
      fact_recall: mean(rows.filter(r => r.kind !== 'refusal').map(r => r.recall)),
      citation_rate: mean(citeCases.map(r => (r.cited ? 1 : 0))),
      refusal_accuracy: mean(by('refusal').map(r => (r.refused && r.invented.length === 0 ? 1 : 0))),
      invented_facts: rows.filter(r => r.invented.length).length,
      by_kind: Object.fromEntries(['fact', 'refusal', 'teach'].map(k => [k, `${by(k).filter(r => r.ok).length}/${by(k).length}`])),
      latency_p50_s: quantile(rows.map(r => r.ms), 0.5) / 1000, latency_p95_s: quantile(rows.map(r => r.ms), 0.95) / 1000,
    },
  };
}

function matchFinding(f, e) {
  const words = `${f.quote ?? ''} ${f.explanation} ${f.suggestion}`;
  return (!e.refs || e.refs.includes(f.ref)) && (!e.type || e.type === f.type) && e.any.some(a => has(words, a));
}

async function runReview(projectId, userId) {
  const { cases } = JSON.parse(fs.readFileSync(path.join(__dirname, 'eval', 'review.json'), 'utf8'));
  const headers = { 'Content-Type': 'application/json', 'X-Service-Token': AI_TOKEN };
  const jobs = [];
  for (const c of cases) {
    const res = await fetch(`${AI}/v1/jobs`, { method: 'POST', headers, body: JSON.stringify({
      kind: 'review', idempotency_key: `eval-${LABEL}-${c.id}`, project_id: projectId, user_id: userId,
      payload: { document: { id: `eval-${c.id}`, title: c.title, text: c.text }, covers: c.covers },
    }) });
    const body = await res.json().catch(() => ({}));
    jobs.push({ c, t0: Date.now(), job: res.ok ? body : { status: 'failed', error: `HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}` } });
  }
  const rows = [];
  for (const j of jobs) {
    let job = j.job;
    while (!['succeeded', 'failed'].includes(job.status) && Date.now() - j.t0 < 400_000) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await fetch(`${AI}/v1/jobs/${job.job_id}?project_id=${projectId}`, { headers });
      if (res.ok) job = await res.json();
    }
    const findings = job.result?.findings ?? [];
    const matched = j.c.expect.filter(e => findings.some(f => matchFinding(f, e)));
    const useful = findings.filter(f => j.c.expect.some(e => matchFinding(f, e)));
    const high = findings.filter(f => f.severity === 'high');
    const ok = job.status === 'succeeded' && (j.c.clean ? high.length === 0 : matched.length === j.c.expect.length);
    rows.push({
      id: j.c.id, status: job.status, error: job.error ?? null, seconds: Math.round((Date.now() - j.t0) / 1000), ok,
      expected: j.c.expect.length, found: matched.length, missed: j.c.expect.filter(e => !matched.includes(e)).map(e => e.id),
      findings: findings.length, matching_findings: useful.length, false_alarms_high: j.c.clean ? high.length : null,
      detail: findings.map(f => `${f.severity} ${f.type} ${f.ref}: ${f.explanation}`),
    });
    console.log(`${ok ? 'PASS' : 'FAIL'}  review ${j.c.id}: ${matched.length}/${j.c.expect.length} defects, ${findings.length} findings${job.error ? `  ${job.error}` : ''}`);
  }
  const planted = rows.filter(r => r.expected > 0);
  const sum = k => planted.reduce((a, r) => a + r[k], 0);
  return {
    rows,
    summary: {
      documents: rows.length, passed: rows.filter(r => r.ok).length,
      recall: sum('expected') ? sum('found') / sum('expected') : 0,
      precision: sum('findings') ? sum('matching_findings') / sum('findings') : 0,
      clean_false_alarms_high: rows.filter(r => r.false_alarms_high !== null).reduce((a, r) => a + r.false_alarms_high, 0),
    },
  };
}

function markdown(res) {
  const lines = [`# AI evaluation — ${LABEL}`, '', `Run ${new Date().toISOString()} · prompts: ${res.prompts.join(', ') || 'n/a'}`, ''];
  if (res.chat) {
    const s = res.chat.summary;
    lines.push('## Assistant', '', '| Metric | Value |', '| --- | --- |',
      `| Cases passed | ${s.passed}/${s.cases} (facts ${s.by_kind.fact}, refusals ${s.by_kind.refusal}, teaching ${s.by_kind.teach}) |`,
      `| Fact recall | ${pct(s.fact_recall)} |`, `| Answers with a valid source (when required) | ${pct(s.citation_rate)} |`,
      `| Correct refusals | ${pct(s.refusal_accuracy)} |`, `| Answers with an invented fact | ${s.invented_facts} |`,
      `| Latency p50 / p95 | ${s.latency_p50_s.toFixed(1)} s / ${s.latency_p95_s.toFixed(1)} s |`, '',
      '| Case | Result | Recall | Source | Notes |', '| --- | --- | --- | --- | --- |',
      ...res.chat.rows.map(r => `| ${r.id} | ${r.ok ? 'pass' : 'FAIL'} | ${pct(r.recall)} | ${r.cited ? 'yes' : 'no'} | ${[r.invented.length ? `invented: ${r.invented.join(', ')}` : '', r.error ?? ''].filter(Boolean).join('; ')} |`), '');
  }
  if (res.review) {
    const s = res.review.summary;
    lines.push('## Document review', '', '| Metric | Value |', '| --- | --- |',
      `| Documents passed | ${s.passed}/${s.documents} |`, `| Planted defects found (recall) | ${pct(s.recall)} |`,
      `| Findings that match a planted defect (precision) | ${pct(s.precision)} |`, `| High-severity false alarms on the clean document | ${s.clean_false_alarms_high} |`, '',
      '| Document | Result | Defects found | Findings | Missed |', '| --- | --- | --- | --- | --- |',
      ...res.review.rows.map(r => `| ${r.id} | ${r.ok ? 'pass' : 'FAIL'} | ${r.found}/${r.expected} | ${r.findings} | ${r.missed.join(', ')} |`), '');
  }
  return lines.join('\n');
}

(async () => {
  const prisma = new PrismaClient();
  const project = await prisma.complianceProject.findFirst({ where: { organization: { name: 'NovaTeck' } }, select: { id: true } });
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  await prisma.$disconnect();
  if (!project || !user) throw new Error('NovaTeck demo data not found: run test/novateck.seed.js and test/novateck.finish.js');
  const res = { label: LABEL, prompts: [] };
  const rescore = arg('rescore');
  if (rescore) {
    // node test/ai-eval.js --rescore baseline-chat --label baseline-chat-v2
    const saved = JSON.parse(fs.readFileSync(path.join(OUT, `${rescore}.json`), 'utf8'));
    Object.assign(res, saved, { label: LABEL, rescored_from: rescore, chat: rescoreChat(saved.chat) });
    fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(res, null, 2));
    fs.writeFileSync(path.join(OUT, `${LABEL}.md`), markdown(res));
    console.log(markdown(res).split('\n').filter(l => /Cases passed|Fact recall/.test(l)).join('\n'));
    return;
  }
  if (!SUITE || SUITE === 'chat') res.chat = await runChat(project.id, await login());
  if (!SUITE || SUITE === 'review') res.review = await runReview(project.id, user.id);
  const metrics = await (await fetch(`${AI}/v1/metrics`, { headers: { 'X-Service-Token': AI_TOKEN } })).json().catch(() => ({}));
  res.prompts = metrics.prompts ?? [];
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(res, null, 2));
  fs.writeFileSync(path.join(OUT, `${LABEL}.md`), markdown(res));
  console.log(`\n${markdown(res).split('\n').filter(l => l.startsWith('| ') && !l.startsWith('| Case') && !l.startsWith('| Document |')).slice(0, 14).join('\n')}`);
  console.log(`\nSaved test/eval/results/${LABEL}.md`);
})().catch(e => { console.error('EVAL FAILED:', e.message); process.exit(1); });
