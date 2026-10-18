/*
 * AI checks against the real stack: the context builder on the scenario
 * project, and the running AI service (apps/ai on AI_SERVICE_URL).
 * Run npm run test:scenario once first, then: npm run test:ai
 */
const path = require('path');

const BACKEND = path.resolve(__dirname, '..');
const DIST = path.join(BACKEND, 'dist');
process.chdir(BACKEND);
require(require.resolve('dotenv', { paths: [BACKEND] })).config({ quiet: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/aptiso_test$2');
const { NestFactory } = require(require.resolve('@nestjs/core', { paths: [BACKEND] }));
const { AppModule } = require(`${DIST}/app.module`);
const { PrismaService } = require(`${DIST}/prisma/prisma.service`);
const { AiContextService } = require(`${DIST}/ai/context.service`);
const { AiServiceClient } = require(`${DIST}/ai/ai-service.client`);
const { AiController } = require(`${DIST}/ai/ai.controller`);

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const expectError = async (fn, check, msg) => {
  try { await fn(); ok(false, `${msg} (no error thrown)`); }
  catch (e) { ok(check(e), `${msg} -> "${e.message.slice(0, 110)}"`); }
};

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);

  // ── Context builder (scenario project) ──
  const project = await prisma.complianceProject.findFirst({ where: { name: 'E2E ISMS' }, orderBy: { created_at: 'desc' } });
  if (!project) {
    ok(false, 'context builder: run npm run test:scenario first (no scenario project)');
  } else {
    const lead = await prisma.projectMember.findFirst({ where: { project_id: project.id, privilege: 'PROJECT_LEAD' } });
    const ctx = app.get(AiContextService);
    const c = await ctx.build(project.id, lead.user_id, { refs: ['A.8.13'] });
    ok(c.soa.length === 1 && c.soa[0].control.code === 'A.8.13' && c.soa[0].applicable === true, 'the context has the SoA row of the control asked about');
    ok(c.risks.length > 0 && c.risks.every(r => r.controls.includes('A.8.13') && /^R-\d{3}$/.test(r.ref)), `the context has the risks treated by A.8.13 (${c.risks.map(r => r.ref).join(', ')})`);
    ok(c.user.role === 'project lead' && ctx.toPrompt(c).includes('<data name="statement_of_applicability">'), 'the context names the user\'s role and tags project data as data');
    const outsider = await prisma.user.create({ data: { email: `outsider${Date.now()}@t.io`, first_name: 'Out', last_name: 'Sider', password_hash: 'x' } });
    await expectError(() => ctx.build(project.id, outsider.id), e => /not a member/.test(e.message), 'someone outside the project gets no context');
  }

  // ── AI service (apps/ai) ──
  const service = app.get(AiServiceClient);
  const ready = await service.request('GET', '/v1/health/ready');
  ok(ready.status === 'ok' && ready.checks.database.pgvector && ready.checks.redis.ok && ready.catalog === 'iso27001-2022@1',
    `the backend reaches the AI service with its token (pgvector ${ready.checks.database.pgvector}, Redis ok, catalog ${ready.catalog})`);
  const health = await app.get(AiController).health();
  ok(health.ai_service === 'ok' && health.checks.database.ok, `GET /ai/health reports the AI service ok (${health.latency_ms} ms)`);
  const configWith = values => ({ get: k => ({ AI_SERVICE_URL: process.env.AI_SERVICE_URL, AI_SERVICE_TOKEN: process.env.AI_SERVICE_TOKEN, ...values })[k] });
  const wrongToken = new AiServiceClient(configWith({ AI_SERVICE_TOKEN: 'x'.repeat(40) }));
  ok((await wrongToken.call('GET', '/v1/health/ready')).status === 401, 'the AI service refuses a wrong service token');
  await expectError(() => wrongToken.request('GET', '/v1/health/ready'), e => e.getStatus?.() === 503, 'a refused token surfaces as "AI unavailable" (503), not as a login error');
  const down = new AiServiceClient(configWith({ AI_SERVICE_URL: 'http://127.0.0.1:1' }));
  await expectError(() => down.request('GET', '/v1/health/ready'), e => e.getStatus?.() === 503, 'an unreachable AI service gives 503');

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  await app.close();
  // No process.exit(): on Windows it aborts while fetch's keep-alive sockets are closing.
  process.exitCode = failures === 0 ? 0 : 1;
})().catch(e => { console.error('CRASH', e); process.exitCode = 2; });
