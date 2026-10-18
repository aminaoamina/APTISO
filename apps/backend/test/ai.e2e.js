/*
 * AI core test, with a fake model (no network): JSON repair, schema and ISO
 * catalog validation, retry with the exact errors, fallback model, auth errors,
 * streaming, AI run records and the context builder. Run with: npm run test:ai
 *
 * Uses the scenario test database (run npm run test:scenario once first, for the
 * context builder checks).
 */
const path = require('path');
const { execSync } = require('child_process');

const BACKEND = path.resolve(__dirname, '..');
const DIST = path.join(BACKEND, 'dist');
process.chdir(BACKEND);
require(require.resolve('dotenv', { paths: [BACKEND] })).config({ quiet: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/aptiso_test$2');
process.env.NVIDIA_API_KEY = 'test-key';
execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });
const { NestFactory } = require(require.resolve('@nestjs/core', { paths: [BACKEND] }));
const { APIConnectionError, APIError } = require(require.resolve('openai', { paths: [BACKEND] }));
const { z } = require(require.resolve('zod', { paths: [BACKEND] }));
const { AppModule } = require(`${DIST}/app.module`);
const { PrismaService } = require(`${DIST}/prisma/prisma.service`);
const { AiClient, AiRejectedError } = require(`${DIST}/ai/ai.client`);
const { CatalogService } = require(`${DIST}/ai/catalog.service`);
const { AiContextService } = require(`${DIST}/ai/context.service`);
const { parseModelJson } = require(`${DIST}/ai/json`);
const { proseText, quoteIn } = require(`${DIST}/ai/text`);

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const expectError = async (fn, check, msg) => {
  try { await fn(); ok(false, `${msg} (no error thrown)`); }
  catch (e) { ok(check(e), `${msg} -> "${e.message.slice(0, 110)}"`); }
};

/** Replaces the provider: `answer(body, call)` returns text, an Error to throw, or an array of stream chunks. */
function fakeModel(ai, answer) {
  const calls = [];
  ai.client.chat.completions.create = async (body) => {
    calls.push(body);
    const r = await answer(body, calls.length);
    if (r instanceof Error) throw r;
    if (body.stream) return (async function* () { for (const t of r) yield { choices: [{ delta: { content: t } }] }; yield { choices: [], usage: { prompt_tokens: 5, completion_tokens: r.length } }; })();
    return { model: body.model, choices: [{ message: { content: r } }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
  };
  return calls;
}

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const ai = app.get(AiClient);
  const catalog = app.get(CatalogService);
  const runOf = id => prisma.aiRun.findUnique({ where: { id } });

  // ── ISO catalog ──
  const backup = (await catalog.all()).find(e => e.ref === 'A.8.13');
  ok((await catalog.all()).filter(e => e.kind === 'control').length === 93, 'the catalog has the 93 Annex A controls of ISO/IEC 27001:2022');
  ok(await catalog.resolve('A.5.15') === 'A.5.15' && await catalog.resolve('a 5.15') === 'A.5.15' && await catalog.resolve('5.15') === 'A.5.15', '"A.5.15", "a 5.15" and "5.15" resolve to A.5.15');
  ok(await catalog.resolve('5.1') === '5.1' && await catalog.resolve('Clause 9.2.2') === '9.2.2', 'clause numbers stay clauses (5.1, 9.2.2)');
  ok(await catalog.resolve(backup.title) === 'A.8.13', `a control title resolves to its ID ("${backup.title}" -> A.8.13)`);
  ok(await catalog.resolve('A.12.3.1') === null && await catalog.resolve('A.9.9') === null, '2013 numbers and invented controls are rejected (A.12.3.1, A.9.9)');

  // ── Text helpers ──
  const doc = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Rules' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Backups are ' }, { type: 'text', text: 'tested', marks: [{ type: 'bold' }] }, { type: 'text', text: ' monthly.' }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Daily copies' }] }] }] },
    { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A.8.13' }] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Yes' }] }] }] }] },
  ] };
  ok(proseText(doc) === '## 3. Rules\nBackups are tested monthly.\n- Daily copies\nA.8.13 | Yes', 'documents become plain text with headings, lists and tables');
  ok(quoteIn(proseText(doc), 'backups are  TESTED monthly') && !quoteIn(proseText(doc), 'tested weekly'), 'quotes are checked word for word (spacing and case ignored)');
  ok(parseModelJson('Here it is:\n```json\n{"a": [1, 2,],}\n```').a.length === 2, 'JSON in code fences, with prose and trailing commas, is repaired');

  // ── Structured output: catalog check and retry with the exact errors ──
  const schema = z.object({ controls: z.array(z.string()) });
  const checkRefs = v => v.controls.filter(c => !['A.8.13', 'A.8.14'].includes(c)).map(c => `"${c}" is not an ISO/IEC 27001:2022 control`);
  const prompt = { id: 'test', version: 1, system: 'List controls.' };
  let calls = fakeModel(ai, (_, n) => (n === 1 ? '```json\n{"controls": ["A.12.3.1"]}\n```' : '{"controls": ["A.8.13"]}'));
  const good = await ai.generateStructured('wizard_suggest', prompt, 'backups', schema, { subjectType: 'test' }, checkRefs);
  ok(good.value.controls[0] === 'A.8.13' && calls.length === 2, 'a 2013 control ID is rejected and the model corrects it on the second attempt');
  ok(calls[1].messages.at(-1).content.includes('"A.12.3.1" is not an ISO/IEC 27001:2022 control'), 'the retry tells the model exactly what was wrong');
  ok(calls[0].response_format?.type === 'json_object' && calls[0].chat_template_kwargs.enable_thinking === false, 'JSON mode on, reasoning off for a fast capability');
  const goodRun = await runOf(good.runId);
  ok(goodRun.status === 'SUCCEEDED' && goodRun.validation.attempts === 2 && goodRun.prompt_version === 'test@1' && goodRun.input_hash.length === 64 && goodRun.tokens_in === 20,
    'the AI run records status, attempts, prompt version, input hash and tokens');

  fakeModel(ai, () => '{"controls": ["A.99.1"]}');
  await expectError(() => ai.generateStructured('wizard_suggest', prompt, 'x', schema, {}, checkRefs),
    e => e instanceof AiRejectedError && e.errors[0].includes('A.99.1'), 'an answer that fails twice is rejected, not stored as valid');
  ok((await prisma.aiRun.findFirst({ where: { prompt_version: 'test@1', status: 'REJECTED' }, orderBy: { created_at: 'desc' } })).validation.errors.length === 1, 'the rejected run keeps the validation errors');

  fakeModel(ai, () => '{"controls": "A.8.13"}');
  await expectError(() => ai.generateStructured('wizard_suggest', prompt, 'x', schema), e => e instanceof AiRejectedError && /controls/.test(e.errors[0]), 'an answer with the wrong shape is rejected by the schema');

  calls = fakeModel(ai, b => (b.model === ai.models.main ? new APIConnectionError({ message: 'connection reset' }) : '{"controls": []}'));
  const fb = await ai.generateStructured('wizard_suggest', prompt, 'x', schema);
  ok(fb.model === ai.models.fallback && calls.filter(c => c.model === ai.models.main).length === 2, 'network errors are retried once, then the fallback model answers');

  calls = fakeModel(ai, () => new APIError(401, { message: 'bad key' }, 'bad key', new Headers()));
  await expectError(() => ai.generateStructured('wizard_suggest', prompt, 'x', schema), e => e.getStatus?.() === 503, 'an invalid API key gives "AI unavailable" (503)');
  ok(calls.length === 1, 'an authentication error is neither retried nor sent to the fallback');

  calls = fakeModel(ai, () => '{"findings": []}');
  await ai.generateStructured('document_review', prompt, 'x', z.object({ findings: z.array(z.string()) }));
  ok(calls[0].chat_template_kwargs.enable_thinking === true && calls[0].temperature === 0.1, 'the document review uses reasoning and a low temperature');

  // ── Text and streaming ──
  fakeModel(ai, () => ['Back', 'ups are ', 'tested.']);
  const it = ai.stream('companion_chat', prompt, [{ role: 'user', content: 'hi' }], { subjectType: 'test' });
  let streamed = '';
  let step;
  while (!(step = await it.next()).done) streamed += step.value;
  ok(streamed === 'Backups are tested.' && step.value.text === streamed && (await runOf(step.value.runId)).tokens_out === 3, 'answers stream piece by piece and the run is recorded at the end');

  // ── Context builder (scenario project) ──
  const project = await prisma.complianceProject.findFirst({ where: { name: { startsWith: 'E2E' } }, orderBy: { created_at: 'desc' } });
  if (!project) {
    ok(false, 'context builder: run npm run test:scenario first (no scenario project)');
  } else {
    const lead = await prisma.projectMember.findFirst({ where: { project_id: project.id, privilege: 'PROJECT_LEAD' } });
    const ctxSvc = app.get(AiContextService);
    const c = await ctxSvc.build(project.id, lead.user_id, { refs: ['A.8.13'] });
    ok(c.soa.length === 1 && c.soa[0].control.code === 'A.8.13' && c.soa[0].applicable === true, 'the context has the SoA row of the control asked about');
    ok(c.risks.length > 0 && c.risks.every(r => r.controls.includes('A.8.13') && /^R-\d{3}$/.test(r.ref)), `the context has the risks treated by A.8.13 (${c.risks.map(r => r.ref).join(', ')})`);
    ok(c.user.role === 'project lead' && ctxSvc.toPrompt(c).includes('<data name="statement_of_applicability">'), 'the context names the user\'s role and tags project data as data');
    const outsider = await prisma.user.create({ data: { email: `outsider${Date.now()}@t.io`, first_name: 'Out', last_name: 'Sider', password_hash: 'x' } });
    await expectError(() => ctxSvc.build(project.id, outsider.id), e => /not a member/.test(e.message), 'someone outside the project gets no context');
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  await app.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
