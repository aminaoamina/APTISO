/*
 * Finishes the NovaTeck demo project (run test/novateck.seed.js first):
 * the Information Security Policy revised as the CEO asked, the internal
 * audit performed by Omar, the first management review chaired by the CEO,
 * and the 3-year audit programme of Phase 5. E-mails are not sent.
 *
 *   TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register test/novateck.finish.js
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config({ quiet: true });
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const svc = {
  prisma: require('../src/prisma/prisma.service').PrismaService,
  projects: require('../src/projects/projects.service').ProjectsService,
  docs: require('../src/documents/documents.service').DocumentsService,
  library: require('../src/documents/library.service').LibraryService,
  audits: require('../src/audit-prep/internal-audit.service').InternalAuditService,
  reviews: require('../src/audit-prep/management-review.service').ManagementReviewService,
  improvement: require('../src/audit-prep/improvement.service').ImprovementService,
  mail: require('../src/mail/mail.service').MailService,
};
const log = (...a) => console.log('  ', ...a);

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const s = Object.fromEntries(Object.entries(svc).map(([k, v]) => [k, app.get(v)]));
  const { prisma } = s;
  s.mail.transporter.sendMail = async () => ({ messageId: 'seed', accepted: [], rejected: [] });

  const project = await prisma.complianceProject.findFirstOrThrow({ where: { organization: { name: 'NovaTeck' } } });
  const people = await prisma.user.findMany({ where: { email: { startsWith: 'info.aptiso+' } } });
  const id = key => people.find(p => p.email === `info.aptiso+${key}@gmail.com`).id;
  const LEAD = id('amina');
  const steps = await prisma.projectStep.findMany({ where: { phase: { project_id: project.id } } });
  const step = part => steps.find(x => x.key.includes(part));
  const finish = async (st, what) => {
    if ((await prisma.projectStep.findUnique({ where: { id: st.id } })).status !== 'COMPLETED') await s.projects.completeStep(project.id, st.id, LEAD, 'PROJECT_LEAD');
    log(`✔ ${what}`);
  };

  // ── Information Security Policy: the change the CEO asked for, then his approval ──
  const policyStep = step('p1s7.security-policy');
  const policy = await prisma.documentInstance.findUniqueOrThrow({ where: { step_id: policyStep.id } });
  if (policy.status !== 'PUBLISHED') {
    if (policy.status === 'IN_REVIEW') await s.library.withdraw(policy.id, LEAD);
    const text = 'This policy applies to all NovaTeck employees and also to freelancers, contractors and temporary staff who have access to NovaPay, to client data or to the NovaTeck information systems. Their contracts refer to this policy.';
    if (!JSON.stringify(policy.content).includes('freelancers, contractors')) {
      const content = { ...policy.content, content: [...policy.content.content, { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Persons covered by this policy' }] }, { type: 'paragraph', content: [{ type: 'text', text }] }] };
      await s.docs.updateContent(policy.id, { content }, LEAD);
    }
    await s.library.submit(policy.id, LEAD, 'Added freelancers and contractors, as requested by the CEO');
    await s.library.approve(policy.id, id('karim'));
  }
  await finish(policyStep, 'Information Security Policy v1.0, approved by Karim Ben Salah');

  // ── Internal audit, performed by Omar on 12-14 October 2026 ──
  const auStep = step('p4s6.internal-audit');
  let au = await s.audits.get(auStep.id, LEAD);
  let audit = au.audits[0];
  if (audit.status !== 'APPROVED') {
    await s.audits.update(auStep.id, audit.id, {
      start_date: '2026-10-12', end_date: '2026-10-14',
      scope: 'The whole ISMS as defined in the ISMS Scope Document: NovaPay development and operations, Customer Support, HR, Finance and Legal, Tunis head office.',
      criteria: 'ISO/IEC 27001:2022 clauses 4 to 10, the Statement of Applicability and the NovaTeck ISMS policies and procedures.',
      auditees: 'Amina Bayoudh (CISO), Youssef Gharbi (IT), Sarra Mansouri (DevOps), Nour Hamdi (Engineering), Mehdi Jaziri (HR), Ines Bouaziz (Legal), Rania Feki (Support)',
    }, LEAD);
    if (audit.status === 'PLANNED' || audit.status === 'SCHEDULED') await s.audits.start(auStep.id, audit.id, id('omar'));
    au = await s.audits.get(auStep.id, LEAD);
    audit = au.audits[0];
    const FINDINGS = {
      '7.2': ['MINOR_NONCONFORMITY', 'No training records for the 2 Customer Support agents hired in September 2026; the awareness session is planned for 20 November.'],
      'A.5.18': ['MINOR_NONCONFORMITY', 'The quarterly access review of the NovaPay back-office has not been done yet; a former contractor account was found active in GitLab (NC already raised).'],
      'A.8.13': ['OBSERVATION', 'Backups run daily but no restore test has been performed; the second-region copy is planned for December.'],
      '6.2': ['OBSERVATION', 'Objectives are approved but only the baseline has been measured so far.'],
      'A.5.24': ['CONFORMING', 'Incident management procedure approved; the phishing and outage incidents of September and October were recorded and assessed.'],
      '5.2': ['CONFORMING', 'Information Security Policy approved by the CEO and communicated in the #security-news channel.'],
      '6.1.2': ['CONFORMING', 'Risk register with 21 risks, owners assigned, assessed with the approved methodology.'],
      '4.3': ['CONFORMING', 'ISMS scope documented with exclusions (Paris office, marketing website) and their interfaces.'],
    };
    for (const item of audit.items) {
      const [result, evidence] = FINDINGS[item.ref] ?? ['CONFORMING', null];
      if (item.result) continue;
      await s.audits.updateItem(auStep.id, audit.id, item.id, { result, ...(evidence && { evidence }) }, id('omar'));
    }
    await s.audits.report(auStep.id, audit.id, { conclusion: 'The ISMS of NovaTeck conforms to ISO/IEC 27001:2022 and is effectively implemented for most requirements. Two minor nonconformities (competence records, access reviews) and two observations (restore tests, measurement of objectives) must be addressed before the certification audit.' }, id('omar'));
    await s.audits.approve(auStep.id, audit.id, id('karim'));
  }
  if (!(await prisma.documentInstance.findUnique({ where: { step_id: auStep.id } }))) await s.audits.createDocument(auStep.id, LEAD);
  await finish(auStep, 'Internal audit 12-14 Oct 2026 by Omar Chebbi: 2 minor nonconformities, 2 observations, report approved by the CEO');

  // Corrective actions for the audit findings
  const reg = await s.improvement.getRegisters(project.id, LEAD);
  const ACTIONS = {
    '7.2': ['mehdi', 'Training records for every new hire within their first month; awareness session for the 2 agents on 20 November', 'New hires were not in the awareness plan', '2026-11-20'],
    'A.5.18': ['youssef', 'Run the first quarterly access review of NovaPay, AWS and GitLab and keep the signed result', 'Access reviews were planned but had no owner and no date', '2026-11-30'],
  };
  for (const nc of reg.nonconformities.filter(n => n.source === 'INTERNAL_AUDIT' && !n.actions?.length)) {
    const item = audit.items.find(i => i.id === nc.audit_item_id);
    const a = ACTIONS[item?.ref];
    if (!a) continue;
    await s.improvement.updateNonconformity(project.id, nc.id, { root_cause: a[2], responsible_id: id(a[0]) }, LEAD);
    await s.improvement.addAction(project.id, nc.id, { description: a[1], responsible_id: id(a[0]), due_date: a[3] }, LEAD);
  }
  log('✔ Corrective actions for the audit findings (tasks for Mehdi and Youssef)');

  // ── First management review, chaired by the CEO on 16 October 2026 ──
  const mrStep = step('p4s7.management-review');
  let mr = await s.reviews.getReviews(mrStep.id, LEAD);
  let review = mr.reviews[0];
  if (!review) {
    mr = await s.reviews.createReview(mrStep.id, { review_date: '2026-10-16', participant_ids: ['karim', 'leila', 'amina', 'youssef', 'omar'].map(id) }, id('karim'));
    review = mr.reviews[0];
  }
  if (review.status !== 'COMPLETED') {
    const NOTES = {
      '9.3.2a': 'First review: no previous actions.',
      '9.3.2b': 'New: two bank tenders require the certificate; INPDP declaration of the AWS transfer still open.',
      '9.3.2c': 'Client questionnaires ask for MFA and yearly penetration tests: both are in the treatment plan.',
    };
    for (const i of review.inputs) await s.reviews.updateInput(mrStep.id, review.id, i.id, { discussed: true, ...(NOTES[i.item_key] && { notes: NOTES[i.item_key] }) }, id('karim'));
    await s.reviews.updateReview(mrStep.id, review.id, { conclusions: 'The ISMS is suitable and adequate for NovaTeck and is becoming effective. Top management confirms the target of certification in June 2027, approves the resources of the risk treatment plan and asks that the audit findings be closed before the end of the year.' }, id('karim'));
    for (const d of [
      { type: 'RESOURCES', description: 'Budget of 8,000 EUR for the external penetration test of NovaPay in February 2027', responsible: 'leila', due: '2026-12-15' },
      { type: 'IMPROVEMENT', description: 'Close the two internal audit nonconformities and run the first backup restore test', responsible: 'amina', due: '2026-12-31' },
      { type: 'ISMS_CHANGE', description: 'Choose the certification body and book the stage 1 audit for May 2027', responsible: 'amina', due: '2027-01-31' },
    ]) {
      mr = await s.reviews.addDecision(mrStep.id, review.id, { type: d.type, description: d.description }, id('karim'));
      const added = mr.reviews.find(r => r.id === review.id).decisions.find(x => x.description === d.description);
      await s.reviews.updateDecision(mrStep.id, review.id, added.id, { responsible_id: id(d.responsible), due_date: d.due }, id('karim'));
    }
    await s.reviews.completeReview(mrStep.id, review.id, id('karim'));
  }
  if (!(await prisma.documentInstance.findUnique({ where: { step_id: mrStep.id } }))) await s.reviews.createDocument(mrStep.id, LEAD);
  await finish(mrStep, 'First management review 16 Oct 2026, chaired by Karim Ben Salah: 3 decisions with owners and due dates');

  // Phase 5: the maintenance cycle started with the review; the audit programme needs the certification date (June 2027).
  log('✔ Phase 5 started: recurring activities scheduled; the audit programme comes once the certification date is known');

  const view = await s.projects.findOne(project.id, LEAD);
  console.log(`\nNovaTeck: ${view.progress.completed_steps}/${view.progress.total_steps} steps (${view.progress.percent}%).`);
  await app.close();
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
