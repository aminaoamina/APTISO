/*
 * Scenario test: a full ISO 27001 project through the five phases, plus tasks,
 * notifications, requests, document approval, evidence, the Drive mirror
 * (simulated) and the exports. Run with: npm run test:scenario
 *
 * It uses its own database (TEST_DATABASE_URL, default: DATABASE_URL with the
 * database name "aptiso_test"), migrated before the run. No e-mail is sent and
 * no Google call is made; evidence files go to a temporary folder.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const BACKEND = path.resolve(__dirname, '..');
const DIST = path.join(BACKEND, 'dist');
process.chdir(BACKEND);
require(require.resolve('dotenv', { paths: [BACKEND] })).config({ quiet: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/aptiso_test$2');
process.env.CONNECTOR_SECRET_KEY = 'scenario-test-connector-secret-key-32+';
process.env.EVIDENCE_STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aptiso-evidence-'));
execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });
const { NestFactory } = require(require.resolve('@nestjs/core', { paths: [BACKEND] }));
const { AppModule } = require(`${DIST}/app.module`);
const { PrismaService } = require(`${DIST}/prisma/prisma.service`);
const { ProjectsService } = require(`${DIST}/projects/projects.service`);
const { RiskRegisterService } = require(`${DIST}/risk-register/risk-register.service`);
const { SoaService } = require(`${DIST}/soa/soa.service`);
const { PoliciesService } = require(`${DIST}/policies/policies.service`);
const { TrainingsService } = require(`${DIST}/audit-prep/trainings.service`);
const { ObjectivesService } = require(`${DIST}/audit-prep/objectives.service`);
const { ImprovementService } = require(`${DIST}/audit-prep/improvement.service`);
const { InternalAuditService } = require(`${DIST}/audit-prep/internal-audit.service`);
const { ManagementReviewService } = require(`${DIST}/audit-prep/management-review.service`);
const { MaintenanceService } = require(`${DIST}/maintenance/maintenance.service`);
const { AuditProgramService } = require(`${DIST}/maintenance/audit-program.service`);
const { LibraryService } = require(`${DIST}/documents/library.service`);
const { DocumentsService } = require(`${DIST}/documents/documents.service`);
const { TasksService } = require(`${DIST}/tasks/tasks.service`);
const { NotificationsService } = require(`${DIST}/notifications/notifications.service`);
const { MailService } = require(`${DIST}/mail/mail.service`);
const { RequestsService } = require(`${DIST}/requests/requests.service`);
const { DocxExportService } = require(`${DIST}/documents/docx-export.service`);
const JSZip = require(require.resolve('jszip', { paths: [BACKEND, path.join(BACKEND, '../../node_modules/docx')] }));
const { EvidenceService } = require(`${DIST}/evidence/evidence.service`);
const { DriveSyncService } = require(`${DIST}/connectors/drive-sync.service`);
const { GoogleDriveClient, DriveAuthError } = require(`${DIST}/connectors/google-drive.client`);
const { ExportsService } = require(`${DIST}/exports/exports.service`);
const ExcelJS = require(require.resolve('exceljs', { paths: [BACKEND] }));
const { PassThrough } = require('stream');
const { SchedulerRegistry } = require(require.resolve('@nestjs/schedule', { paths: [BACKEND] }));

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const expectError = async (fn, pattern, msg) => {
  try { await fn(); ok(false, `${msg} (no error thrown)`); }
  catch (e) { ok(pattern.test(e.message), `${msg} -> "${e.message.slice(0, 110)}"`); }
};

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  const projects = app.get(ProjectsService);
  const risk = app.get(RiskRegisterService);
  const soa = app.get(SoaService);
  const policies = app.get(PoliciesService);
  const trainings = app.get(TrainingsService);
  const objectives = app.get(ObjectivesService);
  const improvement = app.get(ImprovementService);
  const audits = app.get(InternalAuditService);
  const reviews = app.get(ManagementReviewService);
  const maintenance = app.get(MaintenanceService);
  const program = app.get(AuditProgramService);
  const tasksSvc = app.get(TasksService);
  const inbox = app.get(NotificationsService);
  // No real e-mail from tests: capture what would be sent.
  const sent = [];
  app.get(MailService).transporter.sendMail = async m => { sent.push(m); return { messageId: 'test' }; };
  const settle = () => new Promise(r => setTimeout(r, 300));
  // A register step is finished once its generated document is in the library (clause 7.5.3).
  const toLibrary = async stepId => {
    const d = await prisma.documentInstance.findUnique({ where: { step_id: stepId }, include: { _count: { select: { versions: true } } } });
    if (d && !d._count.versions) await app.get(LibraryService).submit(d.id, lead.id, 'First issue');
  };
  ok(true, 'application context started (Annex A catalogue check passed)');

  // ── Seed users, organization, project ──
  const stamp = Date.now();
  const lead = await prisma.user.create({ data: { email: `lead${stamp}@t.io`, first_name: 'Lea', last_name: 'Lead', password_hash: 'x' } });
  const owner = await prisma.user.create({ data: { email: `own${stamp}@t.io`, first_name: 'Omar', last_name: 'Owner', password_hash: 'x' } });
  const org = await prisma.organization.create({ data: { name: 'Test Org', created_by: lead.id, members: { create: [{ user_id: lead.id, role: 'ORG_OWNER' }] } } });
  const fw = await prisma.complianceFramework.findFirst({ where: { status: 'AVAILABLE' } });
  const project = await projects.create(org.id, {
    name: 'E2E ISMS', start_date: '2026-10-01', target_date: '2027-06-30', framework_id: fw.id,
  }, lead.id, 'ORG_OWNER');
  ok(project.progress.percent === 0 && project.phases.every(ph => ph.progress === 'NOT_STARTED'), `a new project starts at 0% with every phase not started (${project.progress.total_steps} steps)`);
  await prisma.projectMember.create({ data: { project_id: project.id, user_id: owner.id, privilege: 'PROJECT_MEMBER' } });
  const steps = await prisma.projectStep.findMany({ where: { phase: { project_id: project.id } }, select: { id: true, key: true } });
  const stepId = k => steps.find(s => s.key === k)?.id;
  const rrStep = stepId('iso27001.p2s2.risk-register');
  const soaStep = stepId('iso27001.p2s3.statement-of-applicability');
  ok(!!rrStep && !!soaStep, 'new project has the Risk Register and SoA steps');

  // ── Risk register: 2 assets, weak passwords + no backup, 1 threat each ──
  let st = await risk.saveAssets(rrStep, { assetNames: ['Servers', 'Databases'], customAssets: [] }, lead.id);
  const aid = n => st.assets.find(a => a.name === n).id;
  st = await risk.saveVulnerabilities(rrStep, { vulnerabilitiesByAsset: {
    [aid('Servers')]: ['Backup does not exist or is not regularly performed'],
    [aid('Databases')]: ['Weak passwords'],
  } }, lead.id);
  const vid = n => st.vulnerabilities.find(v => v.name === n).id;
  st = await risk.saveThreats(rrStep, { threatsByAssetVulnerability: {
    [`${aid('Servers')}:${vid('Backup does not exist or is not regularly performed')}`]: ['Equipment failure'],
    [`${aid('Databases')}:${vid('Weak passwords')}`]: ['Access to information system with malicious intent', 'Social engineering'],
  } }, lead.id);
  ok(st.risks.length === 3, `risk list synced from threat selections (${st.risks.length} risks)`);

  const controlsFor = { 'Backup does not exist or is not regularly performed': ['A.8.13'], 'Weak passwords': ['A.5.17', 'A.8.5'] };
  for (const r of st.risks) {
    await risk.updateRisk(r.id, { impact: 2, likelihood: 2, risk_owner_id: owner.id }, lead.id);
    await risk.updateRisk(r.id, { treatment_controls: controlsFor[r.vulnerability.name], residual_impact: 1, residual_likelihood: 0 }, lead.id);
    await risk.confirmTreatment(r.id, lead.id);
  }
  st = await risk.reviewRisks(rrStep, { riskIds: st.risks.map(r => r.id) }, lead.id);
  for (const r of st.risks) await risk.approveRisk(r.id, { approval_decision: 'APPROVED' }, owner.id);
  await risk.createDocuments(rrStep, lead.id);
  const rrDone = await risk.getCompletion(rrStep);
  ok(rrDone.ready, 'risk register checklist complete');
  let view = await projects.findOne(project.id, lead.id);
  const p2 = view.phases.find(ph => ph.order === 2);
  ok(p2.progress === 'IN_PROGRESS' && p2.steps.find(st => st.id === rrStep).progress === 'IN_PROGRESS' && view.phases[0].progress === 'NOT_STARTED',
    'register work puts the step and Phase 2 in progress before anything is finished; untouched Phase 1 stays not started');
  ok(view.progress.percent === 0 && view.progress.in_progress_steps >= 1, 'nothing finished yet: 0% with steps in progress');

  // SoA cannot be finished while the risk register step is open
  await expectError(() => projects.completeStep(project.id, soaStep, lead.id, 'PROJECT_LEAD'), /not complete/, 'SoA completion blocked before anything is done');
  await toLibrary(rrStep);
  await projects.completeStep(project.id, rrStep, lead.id, 'PROJECT_LEAD');
  const review = await prisma.taskAssignment.findFirst({ where: { step_id: rrStep, type: 'RISK_REVIEW' } });
  ok(!!review && review.deadline > new Date(Date.now() + 360 * 864e5), 'finishing the register scheduled the yearly risk review');

  // ── SoA stage 1: setup ──
  let s = await soa.getSoa(soaStep, lead.id);
  ok(s.rows.length === 0 && !s.setup.completedAt, 'SoA starts empty, waiting for setup');
  const answers = Object.fromEntries(s.setup.questions.map(q => [q.key, true]));
  answers.develops_software = false;
  answers.uses_cloud = false;
  answers.outsources_development = false;
  await expectError(() => soa.saveSetup(soaStep, { answers: { develops_software: false } }, lead.id), /Answer every setup question/, 'setup requires every answer');
  s = await soa.saveSetup(soaStep, { answers }, lead.id);
  const row = code => s.rows.find(r => r.control.code === code);
  ok(s.rows.length === 93, `93 Annex A controls created (${s.rows.length})`);
  ok(row('A.8.25').applicable === false && /does not develop software/.test(row('A.8.25').justification), 'A.8.25 not applicable because no in-house development');
  ok(row('A.5.23').applicable === false, 'A.5.23 not applicable because no cloud services');
  ok(row('A.8.13').applicable === true && /R-00\d/.test(row('A.8.13').justification), `A.8.13 applicable, justified by risk: "${row('A.8.13').justification}"`);
  ok(row('A.5.17').treated_risks.length === 2, 'A.5.17 linked to the 2 weak-password risks');
  ok(row('A.5.1').applicable === true && !!row('A.5.1').implementation_method, 'baseline control applicable with a suggested method');

  // ── Audit rule: cannot exclude a control used in risk treatment ──
  await expectError(() => soa.updateControl(row('A.5.17').id, { applicable: false }, lead.id), /must be applicable/, 'A.5.17 cannot be marked not applicable');

  // ── Stage 3: plan cannot be confirmed without statuses ──
  await expectError(() => soa.confirmTreatmentPlan(soaStep, lead.id), /cannot be confirmed/, 'plan blocked while statuses are missing');
  for (const r of s.rows.filter(r => r.applicable)) {
    const planned = ['A.8.13', 'A.5.17'].includes(r.control.code);
    await prisma.soaControl.update({ where: { id: r.id }, data: { status: planned ? 'PLANNED' : 'IMPLEMENTED' } });
  }
  await soa.updateControl(row('A.8.13').id, { responsible_id: owner.id, deadline: '2026-12-31', resources: 'Backup NAS, about 2000 EUR' }, lead.id);
  await soa.updateControl(row('A.5.17').id, { responsible_id: owner.id, deadline: '2026-11-30' }, lead.id);
  s = await soa.confirmTreatmentPlan(soaStep, lead.id);
  ok(!!s.rtpConfirmedAt && s.summary.planned === 2, `plan confirmed with ${s.summary.planned} controls`);
  const tasks = await prisma.taskAssignment.count({ where: { step_id: soaStep, type: 'IMPLEMENT_CONTROL', assigned_to: owner.id } });
  ok(tasks === 2, `2 implementation tasks created for the responsible person (${tasks})`);

  // ── Stage 4/5: approvals ──
  await expectError(() => soa.ownerApproval(soaStep, { decision: 'APPROVED' }, owner.id), /resource requests/, 'owner approval blocked while resources are pending');
  await expectError(() => soa.decideResources(row('A.8.13').id, { decision: 'APPROVED' }, owner.id), /top management/, 'a plain member cannot approve resources');
  await soa.decideResources(row('A.8.13').id, { decision: 'APPROVED' }, lead.id);
  s = await soa.ownerApproval(soaStep, { decision: 'APPROVED' }, owner.id);
  ok(s.approvals.length === 1 && s.approvals[0].decision === 'APPROVED', 'the risk owner approved the plan and residual risks');

  // A later change resets the approval and the plan confirmation
  await soa.updateControl(row('A.5.17').id, { deadline: '2026-12-15' }, lead.id);
  s = await soa.getSoa(soaStep, lead.id);
  ok(s.approvals[0].decision === 'PENDING' && !s.rtpConfirmedAt, 'editing the plan resets approval and confirmation');
  await soa.confirmTreatmentPlan(soaStep, lead.id);
  const reused = await prisma.taskAssignment.count({ where: { step_id: soaStep, type: 'IMPLEMENT_CONTROL' } });
  ok(reused === 2, 're-confirming updates the existing tasks instead of duplicating them');
  await soa.ownerApproval(soaStep, { decision: 'APPROVED' }, owner.id);

  // ── Document + completion ──
  let c = await soa.getCompletion(soaStep);
  ok(!c.ready && c.items.find(i => i.key === 'document' && !i.done), 'completion waits for the document');
  const [doc] = await soa.createDocument(soaStep, lead.id);
  const headings = doc.content.content.filter(n => n.type === 'heading').map(n => n.content[0].text);
  ok(headings.includes('5. Risk Treatment Plan') && headings.includes('6. Approval by the risk owners'), 'document has SoA, plan and approval sections');
  c = await soa.getCompletion(soaStep);
  ok(c.ready, `SoA checklist complete (${c.items.filter(i => i.done).length}/${c.items.length})`);
  await expectError(() => projects.completeStep(project.id, soaStep, lead.id, 'PROJECT_LEAD'), /to the library/, 'a register step cannot be finished while its document is not in the library');
  await toLibrary(soaStep);
  await projects.completeStep(project.id, soaStep, lead.id, 'PROJECT_LEAD');
  const done = await prisma.projectStep.findUnique({ where: { id: soaStep } });
  ok(done.status === 'COMPLETED', 'SoA step completed');
  view = await projects.findOne(project.id, lead.id);
  ok(view.progress.completed_steps === 2 && view.progress.percent === Math.round(200 / view.progress.total_steps), `overall progress counts steps: ${view.progress.completed_steps}/${view.progress.total_steps} = ${view.progress.percent}%`);
  ok((await projects.findAllForOrg(org.id, lead.id))[0].progress.percent === view.progress.percent, 'the projects list shows the same percentage');

  // ── Phase 3: policies generated from the SoA ──
  const phase3 = await prisma.projectPhase.findFirst({ where: { project_id: project.id, order: 3 }, include: { steps: true } });
  ok(phase3.name === 'Security Documentation', `phase 3 is named "${phase3.name}"`);
  const titles = phase3.steps.map(st => st.title);
  console.log(`      ${titles.length} policy steps: ${titles.join(' | ')}`);
  ok(titles.includes('Backup policy') && titles.includes('Password policy') && titles.includes('Access control policy'), 'Backup, Password and Access control policies were added');
  ok(!titles.includes('Secure development policy'), 'no Secure development policy (the company does not develop software)');
  ok(titles.includes('Bring your own device policy'), 'BYOD policy added because personal devices are used');
  const backup = phase3.steps.find(st => st.title === 'Backup policy');
  ok(backup.metadata_json.why.includes('as you specified in the Statement of Applicability') && backup.metadata_json.controls.includes('A.8.13'),
    `Backup policy is mandatory from the SoA and covers ${backup.metadata_json.controls.join(', ')}`);

  const info = await policies.getPolicy(backup.id, lead.id);
  ok(info.controls.some(c => c.code === 'A.8.13' && c.status === 'PLANNED'), 'policy step shows the SoA status of its controls');
  const draft = await policies.createDraft(backup.id, lead.id);
  const dh = draft.content.content.filter(n => n.type === 'heading').map(n => n.content[0].text);
  ok(dh.some(h => h.includes('(A.8.13)')) && dh.includes('5. Validity and document management'), `draft has a section per control: ${dh.filter(h => h.startsWith('3.')).join('; ')}`);
  ok(draft.answers.generated_from === 'statement_of_applicability' && draft.answers.controls.length > 0, 'draft stores its inputs for the AI engine');
  await expectError(() => policies.createDraft(backup.id, lead.id), /already has a document/, 'a second draft is refused while one exists');
  // ── A document step is finished once its document is approved into the library (clause 7.5) ──
  const libSvc = app.get(LibraryService);
  const docSvc = app.get(DocumentsService);
  await expectError(() => projects.completeStep(project.id, backup.id, lead.id, 'PROJECT_LEAD'), /Submit the document/, 'a document step cannot be finished before its document is in the library');
  await docSvc.updateAssignments(draft.id, { owner_id: lead.id, approver_id: owner.id, update_interval: 12 }, lead.id);
  ok((await libSvc.submit(draft.id, lead.id, 'First issue')).status === 'IN_REVIEW', 'with an approver, submitting sends the document for approval');
  const approveTask = await prisma.taskAssignment.findFirst({ where: { document_instance_id: draft.id, type: 'APPROVE_DOCUMENT', status: 'PENDING' } });
  ok(approveTask?.assigned_to === owner.id, 'the approver gets an approval task linked to the document');
  await expectError(() => docSvc.updateContent(draft.id, { content: { type: 'doc', content: [] } }, lead.id), /waiting for approval/, 'the document is locked while waiting for approval');
  await expectError(() => libSvc.approve(draft.id, lead.id), /Only the approver/, 'only the approver can approve');
  ok((await libSvc.requestChanges(draft.id, owner.id, 'Add the retention period')).status === 'DRAFT', 'the approver can send it back with changes to make');
  ok((await prisma.taskAssignment.findUnique({ where: { id: approveTask.id } })).completion_notes === 'Changes requested: Add the retention period', 'the requested changes are kept on the task');
  await libSvc.submit(draft.id, lead.id, 'Retention added');
  ok((await libSvc.withdraw(draft.id, lead.id)).status === 'DRAFT', 'the sender can withdraw it');
  await libSvc.submit(draft.id, lead.id, 'Retention added');
  const docApproved = await libSvc.approve(draft.id, owner.id);
  const v1 = await prisma.documentVersion.findFirst({ where: { document_id: draft.id } });
  ok(docApproved.version === '1.0' && v1.approved_by === owner.id && v1.published_by === lead.id && v1.notes === 'Retention added', 'approval publishes version 1.0 recording who approved and who submitted');
  // Document control is printed from live data, never typed into the text (clause 7.5.2)
  ok(!JSON.stringify(draft.content).includes('Change history') && !JSON.stringify(draft.content).includes('Document code'), 'the draft text has no frozen control table');
  const docxText = async () => {
    const { buffer } = await app.get(DocxExportService).exportDocument(draft.id);
    return (await (await JSZip.loadAsync(buffer)).file('word/document.xml').async('string')).replace(/<[^>]+>/g, ' ');
  };
  let wordText = await docxText();
  ok(wordText.includes('Change history') && wordText.includes('Retention added') && wordText.includes('Omar Owner') && wordText.includes('Internal'),
    'the Word export opens with the control block and the change history from the library');
  await docSvc.updateAssignments(draft.id, { approver_id: lead.id, code: 'ISMS-POL-07', confidentiality: 'Restricted' }, lead.id);
  wordText = await docxText();
  ok(wordText.includes('ISMS-POL-07') && wordText.includes('Restricted') && wordText.includes('Omar Owner'),
    'new code and confidentiality appear at once; the history keeps who approved version 1.0');
  await projects.completeStep(project.id, backup.id, lead.id, 'PROJECT_LEAD');
  ok(true, 'policy step completed once its document is in the library');
  await projects.reopenStep(project.id, backup.id, lead.id);
  ok((await prisma.projectStep.findUnique({ where: { id: backup.id } })).status === 'NOT_STARTED', 'the lead can reopen a completed step');
  await projects.completeStep(project.id, backup.id, lead.id, 'PROJECT_LEAD');

  // Skipping is for suggested steps only; the requirements register needs requirements
  const ncProc = steps.find(st => st.key === 'iso27001.p4s1.nonconformity-procedure');
  await projects.completeStep(project.id, ncProc.id, lead.id, 'PROJECT_LEAD', true);
  ok((await prisma.projectStep.findUnique({ where: { id: ncProc.id } })).completion_data.skipped === true, 'a suggested step can be skipped, and the decision is recorded');
  await expectError(() => projects.completeStep(project.id, stepId('iso27001.p1s6.isms-scope'), lead.id, 'PROJECT_LEAD', true), /mandatory/, 'a mandatory step cannot be skipped');
  await expectError(() => projects.completeStep(project.id, stepId('iso27001.p1s5.legal-requirements'), lead.id, 'PROJECT_LEAD'), /at least one requirement/, 'the requirements register cannot be finished empty');

  // Excluding the only control of a policy flags it "no longer required" (kept, not deleted)
  const encRow = (await soa.getSoa(soaStep, lead.id)).rows.find(r => r.control.code === 'A.8.24');
  await soa.updateControl(encRow.id, { applicable: false, justification: 'Not applicable: no cryptography is used (test).' }, lead.id);
  const sync = await policies.syncFromSoa(soaStep, lead.id);
  const enc = await prisma.projectStep.findFirst({ where: { phase_id: phase3.id, title: 'Policy on the use of encryption' } });
  ok(sync.noLongerRequired.includes('Policy on the use of encryption') && enc && enc.metadata_json.required === false,
    'encryption policy kept but flagged "no longer required"');

  // ════════════ PHASE 4: Preparation for External Audit ════════════
  const allPhases = await prisma.projectPhase.findMany({ where: { project_id: project.id }, orderBy: { order: 'asc' } });
  ok(allPhases.map(ph => ph.name).join(' | ') === 'Project Preparation | Risk Management | Security Documentation | Preparation for External Audit | ISMS Maintenance & Certification Cycle',
    `Conformio's 5 phases: ${allPhases.map(ph => ph.name).join(' | ')}`);
  const p4 = await prisma.projectStep.findMany({ where: { phase: { project_id: project.id, order: 4 } }, orderBy: { order: 'asc' } });
  ok(p4.length === 7, `Phase 4 has 7 steps: ${p4.map(x => x.title).join(' | ')}`);
  const p4id = key => p4.find(x => x.key === key).id;

  // Step 1: optional procedure draft
  const proc = await policies.createDraft(p4id('iso27001.p4s1.nonconformity-procedure'), lead.id);
  const ph = proc.content.content.filter(n => n.type === 'heading').map(n => n.content[0].text);
  ok(ph.includes('3. Definitions') && ph.some(h => h.includes('Review of effectiveness')), 'nonconformity procedure draft has its sections');

  // Step 3: training plan — needs entered in a step's Training panel are imported
  await projects.confirmTraining(project.id, rrStep, { rows: [{ user_id: owner.id, skills: 'Risk assessment methodology', training: 'ISO 27001 risk course' }] }, lead.id, 'PROJECT_LEAD');
  const trStep = p4id('iso27001.p4s3.training-plan');
  let tr = await trainings.get(trStep, lead.id);
  ok(tr.pendingNeeds.length === 1, 'the training need from the Risk Register step is waiting to be imported');
  tr = await trainings.importNeeds(trStep, lead.id);
  ok(tr.trainings.length === 1 && tr.trainings[0].status === 'PROPOSED' && tr.pendingNeeds.length === 0, 'need imported as a proposed training');
  await expectError(() => trainings.approve(trStep, tr.trainings[0].id, owner.id), /top management/, 'a plain member cannot approve trainings');
  await trainings.approve(trStep, tr.trainings[0].id, lead.id);
  await expectError(() => trainings.update(trStep, tr.trainings[0].id, { status: 'PERFORMED' }, lead.id), /evidence/, 'a training cannot be performed without date and evidence');
  await trainings.createDocument(trStep, lead.id);
  ok((await trainings.getCompletion(trStep)).ready, 'training plan checklist complete');
  await toLibrary(trStep);
  await projects.completeStep(project.id, trStep, lead.id, 'PROJECT_LEAD');

  // Step 4: security objectives — Conformio's 8 defaults
  const objStep = p4id('iso27001.p4s4.security-objectives');
  let ob = await objectives.get(objStep, lead.id);
  ok(ob.objectives.length === 8 && ob.objectives.every(o => o.status === 'DRAFT'), '8 default objectives seeded as drafts');
  ok(ob.objectives[4].title.includes('Finish the ISO 27001 implementation project by'), `objective 5 uses the project target date: "${ob.objectives[4].title}"`);
  await expectError(() => objectives.confirm(objStep, owner.id), /top management/, 'a plain member cannot approve objectives');
  ob = await objectives.confirm(objStep, lead.id);
  ok(ob.objectives.every(o => o.status === 'APPROVED'), 'top management approved the objectives');
  ob = await objectives.addMeasurement(objStep, ob.objectives[0].id, { measured_on: '2026-12-31', result: '9 incidents (-10%)', achieved: true }, lead.id);
  await objectives.createDocument(objStep, lead.id);
  ok((await objectives.getCompletion(objStep)).ready, 'objectives checklist complete');
  await toLibrary(objStep);
  await projects.completeStep(project.id, objStep, lead.id, 'PROJECT_LEAD');

  // Registers: nonconformity lifecycle (clause 10.2) and incidents
  let reg = await improvement.createNonconformity(project.id, { title: 'Backups not tested', description: 'No restore test in 2026', detected_on: '2026-10-05', responsible_id: owner.id }, owner.id);
  let nc = reg.nonconformities[0];
  ok(nc.number === 1 && nc.status === 'ASSIGNED', `NC-001 created and ASSIGNED`);
  reg = await improvement.addAction(project.id, nc.id, { description: 'Schedule quarterly restore tests', responsible_id: owner.id, due_date: '2026-11-30' }, lead.id);
  await expectError(() => improvement.resolve(project.id, nc.id, { effectiveness_review: 'ok' }, lead.id), /correction, the root cause/, 'cannot resolve without correction and root cause');
  reg = await improvement.updateNonconformity(project.id, nc.id, { correction: 'Ran a restore test', root_cause: 'No test schedule' }, lead.id);
  ok(reg.nonconformities[0].status === 'ACTIONS_DEFINED', 'status moves to ACTIONS_DEFINED');
  await expectError(() => improvement.resolve(project.id, nc.id, { effectiveness_review: 'ok' }, lead.id), /not done yet/, 'cannot resolve while actions are open');
  const caTask = await prisma.taskAssignment.findFirst({ where: { type: 'CORRECTIVE_ACTION', assigned_to: owner.id, project_id: project.id } });
  // The task follows its corrective action
  await improvement.updateAction(project.id, nc.id, nc.actions?.[0]?.id ?? (await improvement.getRegisters(project.id, lead.id)).nonconformities[0].actions[0].id, { responsible_id: lead.id, due_date: '2026-12-15' }, lead.id);
  let synced = await prisma.taskAssignment.findUnique({ where: { id: caTask.id } });
  ok(synced.assigned_to === lead.id && synced.deadline.toISOString().startsWith('2026-12-15'), 'changing the action responsible and due date updates its task');
  await improvement.updateAction(project.id, nc.id, synced && (await improvement.getRegisters(project.id, lead.id)).nonconformities[0].actions[0].id, { responsible_id: owner.id }, lead.id);
  await tasksSvc.complete(caTask.id, owner.id);
  reg = await improvement.getRegisters(project.id, lead.id);
  ok(reg.nonconformities[0].actions[0].status === 'DONE', 'completing the task in My Tasks completes the corrective action');
  reg = await improvement.resolve(project.id, nc.id, { effectiveness_review: 'Two restore tests passed' }, lead.id);
  ok(reg.nonconformities[0].status === 'RESOLVED', 'nonconformity resolved after the effectiveness review');

  reg = await improvement.createIncident(project.id, { title: 'Phishing email clicked', description: 'An employee entered credentials', occurred_at: '2026-10-10', severity: 'MEDIUM', affects_confidentiality: true }, lead.id);
  const inc = reg.incidents[0];
  await expectError(() => improvement.updateIncident(project.id, inc.id, { status: 'ASSESSED' }, lead.id), /Assess the event/, 'an incident cannot be assessed without an assessment');
  await improvement.updateIncident(project.id, inc.id, { is_security_incident: true, assessment: 'Credentials compromised', status: 'ASSESSED' }, lead.id);
  await expectError(() => improvement.updateIncident(project.id, inc.id, { status: 'CLOSED' }, lead.id), /response|lessons/, 'a security incident cannot be closed without response and lessons learned');
  reg = await improvement.nonconformityFromIncident(project.id, inc.id, lead.id);
  ok(reg.nonconformities.some(n => n.source === 'INCIDENT' && n.incident_id === inc.id), 'nonconformity raised from the incident');

  // Step 6: internal audit
  const auStep = p4id('iso27001.p4s6.internal-audit');
  let au = await audits.create(auStep, { title: 'Internal audit 2026', start_date: '2026-11-02', end_date: '2026-11-03', lead_auditor_id: owner.id }, lead.id);
  const audit = au.audits[0];
  const applicableCount = await prisma.soaControl.count({ where: { step_id: soaStep, applicable: true } });
  ok(audit.items.length === 25 + applicableCount, `checklist = 25 ISO requirements + ${applicableCount} applicable controls (${audit.items.length})`);
  ok(await prisma.taskAssignment.count({ where: { type: 'INTERNAL_AUDIT', assigned_to: owner.id } }) === 1, 'the lead auditor got an audit task');
  await expectError(() => audits.updateItem(auStep, audit.id, audit.items[0].id, { result: 'CONFORMING' }, lead.id), /Start the audit/, 'results need a started audit');
  await audits.start(auStep, audit.id, lead.id);
  const item72 = audit.items.find(i => i.ref === '7.2');
  await expectError(() => audits.updateItem(auStep, audit.id, item72.id, { result: 'MINOR_NONCONFORMITY' }, lead.id), /evidence/, 'a nonconformity needs evidence');
  au = await audits.updateItem(auStep, audit.id, item72.id, { result: 'MINOR_NONCONFORMITY', evidence: 'No training records for 2 administrators' }, owner.id);
  const auditNc = (await improvement.getRegisters(project.id, lead.id)).nonconformities.find(n => n.audit_item_id === item72.id);
  ok(!!auditNc && auditNc.source === 'INTERNAL_AUDIT', `audit finding recorded in the Nonconformity register as NC-00${auditNc && auditNc.number}`);
  await expectError(() => audits.report(auStep, audit.id, { conclusion: 'x' }, owner.id), /no result yet/, 'cannot report while checklist items are open');
  await prisma.auditChecklistItem.updateMany({ where: { audit_id: audit.id, result: null }, data: { result: 'CONFORMING' } });
  await audits.report(auStep, audit.id, { conclusion: 'The ISMS conforms, with one minor nonconformity.' }, owner.id);
  await expectError(() => audits.approve(auStep, audit.id, owner.id), /top management/, 'the auditor cannot approve the report (member)');
  await audits.approve(auStep, audit.id, lead.id);
  const auDoc = await audits.createDocument(auStep, lead.id);
  ok((await audits.getCompletion(auStep)).ready, 'internal audit checklist complete');
  await toLibrary(auStep);
  await projects.completeStep(project.id, auStep, lead.id, 'PROJECT_LEAD');

  // Step 5: management review setup
  const setupStep = p4id('iso27001.p4s5.management-review-setup');
  let su = await reviews.getSetup(setupStep, lead.id);
  ok(su.setup.items.length === 10 && su.setup.reviewer_ids.includes(lead.id), '10 ISO 9.3.2 inputs by default, lead as reviewer');
  await expectError(() => reviews.saveSetup(setupStep, { frequency: 'YEARLY', reviewer_ids: [lead.id], items: [] }, owner.id), /top management/, 'only top management edits the review setup (Conformio: Sponsor)');
  await reviews.saveSetup(setupStep, { frequency: 'YEARLY', next_review_date: '2026-12-01', reviewer_ids: [lead.id], items: su.setup.items }, lead.id);
  ok((await reviews.getSetupCompletion(setupStep)).ready, 'management review setup complete');
  await projects.completeStep(project.id, setupStep, lead.id, 'PROJECT_LEAD');

  // Step 7: first management mreview
  const mrStep = p4id('iso27001.p4s7.management-review');
  let mr = await reviews.createReview(mrStep, { review_date: '2026-12-01', participant_ids: [lead.id, owner.id] }, lead.id);
  const mreview = mr.reviews[0];
  const input = key => mreview.inputs.find(i => i.item_key === key).summary;
  console.log(`      d1: ${input('9.3.2d1')}\n      d3: ${input('9.3.2d3')}\n      f:  ${input('9.3.2f')}`);
  ok(/3 nonconformity/.test(input('9.3.2d1')) && /1 internal audit/.test(input('9.3.2d3')), 'inputs are summarised from the registers');
  await expectError(() => reviews.completeReview(mrStep, mreview.id, lead.id), /not been discussed/, 'cannot close before every input is discussed');
  for (const i of mreview.inputs) await reviews.updateInput(mrStep, mreview.id, i.id, { discussed: true }, lead.id);
  await reviews.updateReview(mrStep, mreview.id, { conclusions: 'The ISMS is suitable, adequate and effective.' }, lead.id);
  await reviews.addDecision(mrStep, mreview.id, { type: 'RESOURCES', description: 'Budget for security awareness platform' }, lead.id);
  await expectError(() => reviews.completeReview(mrStep, mreview.id, lead.id), /responsible person and a due date/, 'decisions need a responsible and a due date');
  mr = await reviews.getReviews(mrStep, lead.id);
  await reviews.updateDecision(mrStep, mreview.id, mr.reviews[0].decisions[0].id, { responsible_id: owner.id, due_date: '2027-02-01' }, lead.id);
  mr = await reviews.completeReview(mrStep, mreview.id, lead.id);
  const setupAfter = await prisma.managementReviewSetup.findUnique({ where: { project_id: project.id } });
  ok(mr.reviews[0].status === 'COMPLETED' && setupAfter.next_review_date.toISOString().startsWith('2027-12-01'), 'mreview completed; next mreview planned one year later');
  const mrTask = await prisma.taskAssignment.findFirst({ where: { type: 'MANAGEMENT_REVIEW_ACTION', assigned_to: owner.id } });
  ok(!!mrTask, 'the decision became a task for its responsible person');
  await tasksSvc.complete(mrTask.id, owner.id);
  mr = await reviews.getReviews(mrStep, lead.id);
  ok(mr.reviews[0].decisions[0].status === 'DONE', 'completing the task completes the decision');
  await reviews.createDocument(mrStep, lead.id);
  ok((await reviews.getReviewCompletion(mrStep)).ready, 'management mreview checklist complete');
  await toLibrary(mrStep);
  await projects.completeStep(project.id, mrStep, lead.id, 'PROJECT_LEAD');
  const phase4 = await prisma.projectPhase.findFirst({ where: { project_id: project.id, order: 4 } });
  const p4Done = await prisma.projectStep.count({ where: { phase_id: phase4.id, status: 'COMPLETED' } });
  ok(p4Done === 6, `5 mandatory Phase 4 steps completed and the nonconformity procedure skipped (${p4Done}/7)`);

  // ════════════ PHASE 5: ISMS Maintenance & Certification Cycle ════════════
  const p5 = await prisma.projectStep.findFirst({ where: { phase: { project_id: project.id, order: 5 } } });
  ok(p5 && p5.key === 'iso27001.p5s1.maintenance', 'Phase 5 has the maintenance step');
  ok(!!(await prisma.maintenanceSetup.findUnique({ where: { project_id: project.id } })), 'finishing the first management review started the maintenance cycle');
  ok(!!app.get(SchedulerRegistry).getCronJob('isms-maintenance'), 'the nightly maintenance job is registered');

  let mt = await maintenance.get(project.id, lead.id);
  ok(mt.activities.length === 7, `7 recurring activities: ${mt.activities.map(a => a.title).join(' | ')}`);
  const act = (m, k) => m.activities.find(a => a.key === k);
  ok(act(mt, 'risks').open_tasks === 1 && act(mt, 'risks').status === 'ON_TIME', 'review of risks: the yearly task already exists, on time');
  ok(act(mt, 'internal_audit').next_scheduled.toISOString().startsWith('2027-11-03'), `next internal audit = last approved audit + 1 year (${act(mt, 'internal_audit').next_scheduled.toISOString().slice(0, 10)})`);
  ok(act(mt, 'management_review').next_scheduled.toISOString().startsWith('2027-12-01'), 'next management review = date planned by the last review');

  // Certification dates (top management only)
  await expectError(() => maintenance.update(project.id, { certification_date: '2026-12-15' }, owner.id), /top management/, 'a plain member cannot change the certification dates');
  mt = await maintenance.update(project.id, { certification_date: '2026-12-15', certification_body: 'Test CB' }, lead.id);
  ok(mt.dates.next_surveillance_audit.toISOString().startsWith('2027-12-15') && mt.dates.next_recertification.toISOString().startsWith('2029-12-15'),
    `surveillance ${mt.dates.next_surveillance_audit.toISOString().slice(0, 10)}, re-certification ${mt.dates.next_recertification.toISOString().slice(0, 10)}`);

  // Internal audit program (clause 9.2.2)
  const months = mt.audit_program.audits.map(a => a.planned_month.toISOString().slice(0, 7));
  ok(months.join() === '2027-10,2028-10,2029-10',
    `the program plans one audit before each external audit: ${months.join(', ')}`);
  ok(mt.audit_program.audits.every(a => a.auditor_id === lead.id && a.status === 'PLANNED'), 'planned audits start with the project lead as auditor');
  ok(act(mt, 'internal_audit').next_scheduled.toISOString().startsWith('2027-10-01'), 'the next internal audit comes from the program');
  ok(mt.completion.items.find(i => i.key === 'program' && !i.done), 'the Phase 5 step waits for the approved program');
  await program.addAudit(project.id, { planned_month: '2028-04-15', auditor_id: owner.id, scope: 'A.8 Technological controls' }, lead.id);
  await program.createDocument(project.id, lead.id);
  const progDoc = await prisma.documentInstance.findUnique({ where: { step_id: p5.id } });
  ok(JSON.stringify(progDoc.content).includes('A.8 Technological controls'), 'the program document lists the planned audits');
  await app.get(LibraryService).submit(progDoc.id, lead.id, 'First issue');
  ok((await maintenance.get(project.id, lead.id)).completion.items.find(i => i.key === 'program').done, 'the approved program is in the library');
  const extra = (await prisma.programAudit.findFirst({ where: { scope: 'A.8 Technological controls' } })).id;
  await program.removeAudit(project.id, extra, lead.id);
  ok(!(await maintenance.get(project.id, lead.id)).completion.items.find(i => i.key === 'program').done, 'changing the plan needs a new approval');
  await program.createDocument(project.id, lead.id);
  await app.get(LibraryService).submit(progDoc.id, lead.id, 'Audit removed');

  // Time passes: the incident review is due 3 months after the cycle started
  const fourMonthsAgo = new Date(Date.now() - 120 * 864e5);
  await prisma.maintenanceSetup.update({ where: { project_id: project.id }, data: { created_at: fourMonthsAgo } });
  // The monthly objective was approved 2 months ago and never measured
  const monthly = await prisma.securityObjective.findFirst({ where: { project_id: project.id, frequency: 'MONTHLY' } });
  await prisma.securityObjective.update({ where: { id: monthly.id }, data: { approved_at: new Date(Date.now() - 60 * 864e5) } });
  // A published policy with a 1-month review interval, last published 2 months ago
  const pdoc = await prisma.documentInstance.findFirst({ where: { step: { phase: { project_id: project.id, order: 3 } } } });
  await prisma.documentInstance.update({ where: { id: pdoc.id }, data: { status: 'PUBLISHED', update_interval: 1, owner_id: owner.id } });
  // Its version 1.0 (approved above) was published 2 months ago.
  await prisma.documentVersion.updateMany({ where: { document_id: pdoc.id }, data: { published_at: new Date(Date.now() - 60 * 864e5) } });

  const created = await maintenance.runForProject(project.id);
  const count = type => prisma.taskAssignment.count({ where: { project_id: project.id, type, status: { not: 'COMPLETED' } } });
  ok(created === 3, `3 reminders created (incidents, objective, document): ${created}`);
  ok(await count('INCIDENTS_REVIEW') === 1 && await count('OBJECTIVES_REVIEW') === 1 && await count('DOCUMENT_REVIEW') === 1, 'one task per due activity');
  const docTask = await prisma.taskAssignment.findFirst({ where: { type: 'DOCUMENT_REVIEW', project_id: project.id } });
  ok(docTask.assigned_to === owner.id && docTask.activity_key === `document:${pdoc.id}`, 'the document review goes to the document owner');
  ok(await maintenance.runForProject(project.id) === 0 && await maintenance.runAll() >= 0 && await count('INCIDENTS_REVIEW') === 1, 'running again (and the nightly job) creates no duplicates');

  mt = await maintenance.get(project.id, lead.id);
  ok(act(mt, 'incidents').status === 'LATE' && act(mt, 'objectives').status === 'LATE' && act(mt, 'documents').status === 'LATE', 'late activities are flagged');
  ok(!mt.completion.ready && mt.completion.items.find(i => i.key === 'late' && !i.done), 'the Phase 5 step cannot be finished while activities are late');

  // Doing the reviews schedules the next ones
  for (const t of await prisma.taskAssignment.findMany({ where: { project_id: project.id, type: { in: ['INCIDENTS_REVIEW', 'OBJECTIVES_REVIEW', 'DOCUMENT_REVIEW'] }, status: { not: 'COMPLETED' } } })) {
    await tasksSvc.complete(t.id, t.assigned_to);
  }
  mt = await maintenance.get(project.id, lead.id);
  ok(act(mt, 'incidents').status === 'ON_TIME' && act(mt, 'incidents').completed_tasks === 1, `incident review done; next on ${act(mt, 'incidents').next_scheduled.toISOString().slice(0, 10)}`);
  ok(act(mt, 'documents').status !== 'LATE' && act(mt, 'objectives').status !== 'LATE', 'document and objective reviews moved forward');
  ok(await count('INCIDENTS_REVIEW') === 0, 'no new task until the next review is due');
  ok(mt.completion.ready, 'maintenance checklist complete (certified, nothing late)');
  await projects.completeStep(project.id, p5.id, lead.id, 'PROJECT_LEAD');
  ok(true, 'Phase 5 step completed');

  const line = (await maintenance.get(project.id, lead.id)).audit_program.audits[0];
  await program.startAudit(project.id, line.id, lead.id);
  const started = await prisma.programAudit.findUnique({ where: { id: line.id }, include: { internal_audit: { include: { items: true } } } });
  ok(started.internal_audit && started.internal_audit.lead_auditor_id === lead.id && started.internal_audit.items.length > 100,
    `starting a planned audit schedules it with its checklist: "${started.internal_audit.title}"`);
  ok((await maintenance.get(project.id, lead.id)).audit_program.audits[0].status === 'IN_PROGRESS', 'the planned audit is in progress');
  await expectError(() => program.removeAudit(project.id, line.id, lead.id), /has started/, 'a started audit cannot be removed from the program');

  // An external consultant (read-only auditor) performs the internal audit assigned to them
  const consultant = await prisma.user.create({ data: { email: `cons${stamp}@t.io`, first_name: 'Cora', last_name: 'Consultant', password_hash: 'x' } });
  await prisma.projectMember.create({ data: { project_id: project.id, user_id: consultant.id, privilege: 'PROJECT_AUDITOR' } });
  const extAudit = (await audits.create(auStep, { title: 'External consultant audit', start_date: '2027-03-01', end_date: '2027-03-05', lead_auditor_id: consultant.id }, lead.id))
    .audits.find(x => x.title === 'External consultant audit');
  await audits.start(auStep, extAudit.id, consultant.id);
  await audits.updateItem(auStep, extAudit.id, extAudit.items[0].id, { result: 'CONFORMING' }, consultant.id);
  await prisma.auditChecklistItem.updateMany({ where: { audit_id: extAudit.id, result: null }, data: { result: 'CONFORMING' } });
  await audits.report(auStep, extAudit.id, { conclusion: 'Conforming.' }, consultant.id);
  ok((await prisma.internalAudit.findUnique({ where: { id: extAudit.id } })).status === 'REPORTED', 'a read-only auditor assigned as lead auditor performs and reports the audit');
  await expectError(() => audits.update(auStep, extAudit.id, { scope: 'Changed' }, consultant.id), /read-only/, 'the consultant still cannot change the audit setup');

  // Documents need a real approval
  const unpublished = await prisma.documentInstance.findFirst({ where: { step: { phase: { project_id: project.id } }, versions: { none: {} }, approver_id: null } });
  await expectError(() => app.get(LibraryService).submit(unpublished.id, owner.id), /Choose an approver/, 'a member cannot publish a document without an approver');
  await expectError(() => app.get(DocumentsService).updateAssignments(unpublished.id, { approver_id: consultant.id }, lead.id), /read-only/, 'an auditor cannot be a document approver');

  // A new certification cycle gets its yearly audits (the earlier ones moved to the past)
  await prisma.programAudit.updateMany({ where: { program: { project_id: project.id } }, data: { planned_month: new Date('2020-01-01') } });
  await prisma.maintenanceSetup.update({ where: { project_id: project.id }, data: { certification_date: new Date('2023-06-01') } });
  const recert = (await maintenance.get(project.id, lead.id)).audit_program.audits.filter(x => x.planned_month >= new Date('2026-06-01'));
  ok(recert.map(x => x.planned_month.toISOString().slice(0, 7)).join() === '2027-04,2028-04,2029-04', `after re-certification the new cycle has its audits: ${recert.map(x => x.planned_month.toISOString().slice(0, 7)).join(', ')}`);

  // ── Document library: every version is kept (clause 7.5.3) ──
  const library = app.get(LibraryService);
  const documents = app.get(DocumentsService);
  const ldoc = await prisma.documentInstance.findFirst({ where: { step: { phase: { project_id: project.id } }, versions: { none: {} } } });
  ok((await library.submit(ldoc.id, lead.id, 'First issue')).version === '1.0', 'first submission is version 1.0');
  await expectError(() => library.submit(ldoc.id, lead.id), /already in the library/, 'unchanged content cannot be submitted twice');
  const revised = { ...ldoc.content, content: [...ldoc.content.content, { type: 'paragraph', content: [{ type: 'text', text: 'Revision: risk ≥ 3 → treat ✓ (Łódź office)' }] }] };
  ok((await documents.updateContent(ldoc.id, { content: revised }, lead.id)).status === 'DRAFT', 'editing a published document starts a new revision');
  ok((await library.submit(ldoc.id, lead.id, 'Added Łódź office')).version === '1.1', 'second submission is version 1.1 (arrows, ≥, ✓ and ł print)');
  const pdf = await library.getPdf(ldoc.id, '1.0');
  ok(pdf.buffer.subarray(0, 4).toString() === '%PDF' && pdf.filename.endsWith('v1.0.pdf'), `version 1.0 is still downloadable: ${pdf.filename}`);
  await expectError(() => documents.deleteDocument(ldoc.id, lead.id), /cannot be deleted/, 'a document with library versions cannot be deleted');
  const lib = await library.getLibrary(project.organization_id, lead.id);
  ok(lib.find(d => d.id === ldoc.id)?.versions.map(v => v.version).join(',') === '1.1,1.0', 'the library lists both versions, newest first');

  // ── Tasks and notifications ──
  const tomorrow = new Date(Date.now() + 864e5).toISOString();
  const unreadBefore = (await inbox.list(owner.id)).unread_count;
  const t1 = await tasksSvc.assign(project.id, ldoc.step_id, { assigned_to: owner.id, type: 'REVIEW_DOCUMENT', notes: 'Check section 3', deadline: tomorrow }, lead.id);
  ok(t1.document_instance_id === ldoc.id, 'a document task links to the step document');
  let box = await inbox.list(owner.id);
  ok(box.unread_count === unreadBefore + 1 && box.items[0].type === 'TASK_ASSIGNED' && box.items[0].actor.id === lead.id && box.items[0].task_assignment.document.id === ldoc.id,
    'the assignee gets a notification naming who assigned it and linking to the document');
  await settle();
  ok(sent.some(m => m.to === owner.email && /New task: Review document/.test(m.subject)), 'the assignment is e-mailed');
  await expectError(() => tasksSvc.assign(project.id, ldoc.step_id, { assigned_to: owner.id, type: 'CORRECTIVE_ACTION' }, lead.id), /created by its register/, 'register task types cannot be assigned by hand');
  await expectError(() => tasksSvc.update(t1.id, { deadline: null }, owner.id), /Only the person who assigned/, 'the assignee cannot change the deadline');
  const reviewTask = await prisma.taskAssignment.findFirst({ where: { project_id: project.id, type: 'RISK_REVIEW', status: 'PENDING' } });
  await expectError(() => tasksSvc.update(reviewTask.id, { deadline: null }, lead.id), /register/, 'a register task (yearly risk review) is changed from its register');

  await tasksSvc.sendDueReminders();
  await tasksSvc.sendDueReminders();
  ok(await prisma.notification.count({ where: { task_assignment_id: t1.id, type: 'TASK_DUE_SOON' } }) === 1, 'one "due soon" reminder per task, even when the job runs twice');

  await tasksSvc.update(t1.id, { assigned_to: lead.id }, lead.id);
  box = await inbox.list(owner.id);
  ok(box.items[0].type === 'TASK_CANCELLED' && (await prisma.taskAssignment.findUnique({ where: { id: t1.id } })).reminded_at === null, 'reassigning tells the previous assignee and resets the reminder');

  const t2 = await tasksSvc.assign(project.id, ldoc.step_id, { assigned_to: owner.id, type: 'WORK_ON_DOCUMENT' }, lead.id);
  await tasksSvc.cancel(t2.id, lead.id);
  ok(!(await tasksSvc.mine(owner.id)).some(t => t.id === t2.id), 'a cancelled task leaves My tasks');
  await expectError(() => tasksSvc.complete(t2.id, owner.id), /already closed/, 'a cancelled task cannot be completed');

  const t3 = await tasksSvc.assign(project.id, ldoc.step_id, { assigned_to: owner.id, type: 'REVIEW_DOCUMENT' }, lead.id);
  const t3done = await tasksSvc.complete(t3.id, owner.id, 'Approved version 1.1');
  ok(t3done.status === 'COMPLETED' && t3done.completion_notes === 'Approved version 1.1', 'completion notes are kept with the task');
  box = await inbox.list(lead.id);
  ok(box.items[0].type === 'TASK_COMPLETED' && box.items[0].actor.id === owner.id, 'the assigner is told who completed it');
  ok((await tasksSvc.team(lead.id)).some(t => t.id === t3.id), 'the lead sees it in the team tasks');

  // ── Resource requests (clause 7.1): decided by top management, not tasks ──
  const requestsSvc = app.get(RequestsService);
  const topMgmt = await prisma.projectMember.findMany({ where: { project_id: project.id, iso_roles: { some: { iso_role: 'TOP_MANAGEMENT' } } }, select: { user_id: true } });
  const decider = topMgmt[0]?.user_id ?? lead.id;
  const tasksBefore = await prisma.taskAssignment.count({ where: { project_id: project.id } });
  const rq = await requestsSvc.create(project.id, ldoc.step_id, { kind: 'FINANCE', description: 'Budget for a SIEM' }, owner.id);
  ok(rq.status === 'PENDING' && await prisma.taskAssignment.count({ where: { project_id: project.id } }) === tasksBefore, 'a budget request is a request, not a task');
  ok((await inbox.list(decider)).items[0].type === 'REQUEST_RECEIVED', 'top management is notified of the request');
  ok((await requestsSvc.awaitingMe(decider)).some(r => r.id === rq.id) && !(await requestsSvc.awaitingMe(owner.id)).some(r => r.id === rq.id), 'only the decider sees it waiting');
  ok(!(await requestsSvc.list(project.id, owner.id)).can_decide && (await requestsSvc.list(project.id, decider)).can_decide, 'the requester cannot decide, top management can');
  await expectError(() => requestsSvc.decide(rq.id, { decision: 'APPROVED' }, owner.id), /top management/, 'a member cannot approve a request');
  await expectError(() => requestsSvc.decide(rq.id, { decision: 'REJECTED' }, decider), /reason/, 'a rejection needs a reason');
  const approved = await requestsSvc.decide(rq.id, { decision: 'APPROVED', comment: 'Budget granted for Q1' }, decider);
  ok(approved.status === 'APPROVED' && approved.decider.id === decider, 'top management approved the request');
  ok((await inbox.list(owner.id)).items[0].type === 'REQUEST_DECIDED', 'the requester is told about the decision');
  await expectError(() => requestsSvc.decide(rq.id, { decision: 'REJECTED', comment: 'no' }, decider), /already been decided/, 'a decision is final');

  await settle();
  const sentBefore = sent.length;
  const self = await tasksSvc.assign(project.id, ldoc.step_id, { assigned_to: lead.id, type: 'WORK_ON_DOCUMENT' }, lead.id);
  box = await inbox.list(lead.id);
  await settle();
  ok(box.items[0].type === 'TASK_ASSIGNED' && box.items[0].task_assignment.id === self.id && sent.length === sentBefore, 'a task I assign myself appears in my bell, without an e-mail');
  ok((await inbox.markRead(owner.id)).unread_count === 0 && (await inbox.list(owner.id)).unread_count === 0, 'mark all as read');

  // ── Evidence on register records, and renewal before it expires ──
  const evSvc = app.get(EvidenceService);
  const [anyNc, anyInc, anyTraining, anyItem] = await Promise.all([
    prisma.nonconformity.findFirst({ where: { project_id: project.id } }),
    prisma.incident.findFirst({ where: { project_id: project.id } }),
    prisma.training.findFirst({ where: { project_id: project.id } }),
    prisma.auditChecklistItem.findFirst({ where: { audit: { project_id: project.id } } }),
  ]);
  const note = { kind: 'NOTE', description: 'Checked on site', collected_on: '2026-10-01' };
  const recEv = await evSvc.create(project.id, { ...note, title: 'Register proof', links: [
    { type: 'NONCONFORMITY', id: anyNc.id }, { type: 'INCIDENT', id: anyInc.id }, { type: 'TRAINING', id: anyTraining.id }, { type: 'AUDIT_ITEM', id: anyItem.id },
  ] }, undefined, lead.id);
  ok(recEv.links.length === 4, 'evidence can prove a nonconformity, an incident, a training and an audit checklist item');
  const labelled = (await evSvc.list(project.id, { type: 'INCIDENT', id: anyInc.id })).find(e => e.id === recEv.id);
  ok(labelled.links.some(l => /^NC-\d{3} /.test(l.label)) && labelled.links.some(l => /^INC-\d{3} /.test(l.label)) && labelled.links.some(l => l.label.startsWith('Training: ')),
    'register links carry readable labels (NC-001, INC-001, Training)');
  await expectError(() => evSvc.create(project.id, { ...note, title: 'x', links: [{ type: 'INCIDENT', id: '00000000-0000-4000-8000-000000000000' }] }, undefined, lead.id), /not in the project/, 'a record of another project is refused');

  const soon = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);
  const expiring = await evSvc.create(project.id, { ...note, title: 'Pentest report 2026', valid_until: soon, links: [{ type: 'CLAUSE', id: '8.1' }] }, undefined, owner.id);
  ok(await evSvc.createRenewalTasks() >= 1 && await evSvc.createRenewalTasks() === 0, 'evidence expiring within 30 days gets one renewal task, even when the job runs twice');
  const renewal = await prisma.taskAssignment.findFirst({ where: { activity_key: `evidence:${expiring.id}` } });
  ok(renewal.type === 'EVIDENCE_RENEWAL' && renewal.assigned_to === owner.id && renewal.deadline.toISOString().startsWith(soon), 'the renewal task goes to whoever added it, due on the expiry date');
  await evSvc.update(expiring.id, { valid_until: '2028-12-31' }, owner.id);
  ok((await prisma.taskAssignment.findUnique({ where: { id: renewal.id } })).status === 'COMPLETED', 'extending the validity completes the renewal task');

  // ── Exports: registers as Excel, library as ZIP ──
  const exportsSvc = app.get(ExportsService);
  const readBook = async buffer => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer); return wb; };
  const all = await readBook((await exportsSvc.registers(project.id, 'all', lead.id)).buffer);
  const sheetNames = all.worksheets.map(w => w.name);
  ok(['Master list of documents', 'Requirements', 'Risk register', 'Statement of Applicability', 'Risk Treatment Plan', 'Nonconformities', 'Corrective actions', 'Incidents', 'Trainings', 'Security objectives', 'Measurements', 'Internal audit program', 'Internal audits', 'Audit checklist', 'Evidence'].every(n => sheetNames.includes(n)),
    `"All registers" has one sheet per register: ${sheetNames.join(', ')}`);
  const soaSheet = all.getWorksheet('Statement of Applicability');
  ok(soaSheet.rowCount === 94 && soaSheet.getRow(1).font?.bold && soaSheet.autoFilter && soaSheet.views[0].state === 'frozen', 'the SoA sheet lists the 93 controls under a bold, frozen, filtered header');
  const riskSheet = all.getWorksheet('Risk register');
  const riskCount = await prisma.riskItem.count({ where: { step: { phase: { project_id: project.id } }, discarding: false } });
  ok(riskSheet.rowCount === riskCount + 1 && typeof riskSheet.getRow(2).getCell(8).value === 'number', `the risk register has ${riskCount} risks with numeric levels`);
  const master = all.getWorksheet('Master list of documents');
  const masterRow = master.getRows(2, master.rowCount - 1).find(r => r.getCell(2).value === ldoc.title);
  ok(masterRow && /^1\.\d+$/.test(String(masterRow.getCell(4).value)) && masterRow.getCell(6).value instanceof Date, `the master list shows "${ldoc.title}" with its approved version and date`);
  const ncSheet = all.getWorksheet('Nonconformities');
  ok(ncSheet.getRow(2).getCell(1).value === 'NC-001', 'nonconformities keep their NC-001 references');
  const one = await exportsSvc.registers(project.id, 'risks', lead.id);
  ok(one.filename.includes('Risk register') && (await readBook(one.buffer)).worksheets.length === 1, `one register alone: "${one.filename}"`);
  await expectError(() => exportsSvc.registers(project.id, 'passwords', lead.id), /Unknown register/, 'unknown registers are refused');

  const zipOf = async options => {
    const out = new PassThrough(); const chunks = []; out.on('data', c => chunks.push(c));
    const ended = new Promise(r => out.on('end', r));
    await exportsSvc.library(project.id, options, lead.id, out);
    await ended;
    return JSZip.loadAsync(Buffer.concat(chunks));
  };
  // A file of evidence for the evidence folder
  await evSvc.create(project.id, { kind: 'FILE', title: 'Restore test', collected_on: '2026-10-01', links: [{ type: 'CLAUSE', id: '8.1' }] },
    { originalname: 'restore.pdf', buffer: Buffer.from('%PDF-1.4 restore'), size: 16 }, lead.id);
  let zip = await zipOf({ earlierVersions: false, evidence: false });
  let names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  const versionsOf = await prisma.documentVersion.count({ where: { document_id: ldoc.id } });
  ok(names.includes('Master list of documents.xlsx') && names.includes('Registers.xlsx'), 'the ZIP has the master list and every register');
  ok(names.some(n => n.endsWith(`v1.${versionsOf - 1}.pdf`) && n.includes(ldoc.title)) && names.some(n => n.endsWith(`v1.${versionsOf - 1}.docx`)),
    'each document has its current approved version as PDF and Word');
  ok(!names.some(n => n.includes('Earlier versions/')) && !names.some(n => n.startsWith('Evidence/')), 'by default: no earlier versions and no evidence files');
  ok(names.some(n => /^3 Security Documentation\/Backup policy\//.test(n)), 'folders by phase, then document');
  const zipWord = (await (await JSZip.loadAsync(await zip.file(names.find(n => n.endsWith('.docx') && n.includes(ldoc.title))).async('nodebuffer'))).file('word/document.xml').async('string'));
  ok(zipWord.includes(`1.${versionsOf - 1}`), 'the Word copy is of the approved version, with its document control block');
  zip = await zipOf({ earlierVersions: true, evidence: true });
  names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  ok(names.filter(n => n.includes(`${ldoc.title}/Earlier versions/`)).length === versionsOf - 1, `earlier versions on request (${versionsOf - 1} for "${ldoc.title}")`);
  ok(names.some(n => /^Evidence\/Clause 8\.1 .*\/Restore test - restore\.pdf$/.test(n)), 'evidence files on request, in a folder named after what they prove');
  ok(await prisma.auditLog.count({ where: { action: 'DATA_EXPORTED', entity_id: project.id } }) >= 4, 'every export is recorded in the audit log');

  // ── Drive mirror (Google Drive simulated: no network) ──
  const drive = app.get(DriveSyncService);
  const gd = app.get(GoogleDriveClient);
  const remote = { folders: [], files: [], failNext: 0, authBroken: false };
  Object.defineProperty(gd, 'configured', { get: () => true });
  gd.exchangeCode = async () => ({ refreshToken: 'refresh-123', accessToken: 'access', email: 'isms@novatech.test' });
  gd.accessToken = async () => { if (remote.authBroken) throw new DriveAuthError('revoked'); return 'access'; };
  gd.createFolder = async (_t, name, parent) => { const id = `f${remote.folders.length + 1}`; remote.folders.push({ id, name, parent }); return id; };
  gd.upload = async (_t, parent, name, mime, data) => {
    if (remote.failNext > 0) { remote.failNext--; throw new Error('Google Drive error 503: backend error'); }
    const id = `file${remote.files.length + 1}`; remote.files.push({ id, parent, name, mime, size: data.length }); return id;
  };
  gd.revoke = async () => { remote.revoked = true; };

  const { url } = drive.startGoogle(org.id, lead.id);
  const state = new URL(url).searchParams.get('state');
  ok(/accounts\.google\.com/.test(url) && /drive\.file/.test(decodeURIComponent(url)), 'connecting asks Google only for access to the files APTISO creates (drive.file)');
  await expectError(() => drive.finishGoogle('code', state.slice(0, -2) + 'xx'), /expired/, 'a tampered sign-in link is refused');
  const ownerState = new URL(drive.startGoogle(org.id, owner.id).url).searchParams.get('state');
  await expectError(() => drive.finishGoogle('code', ownerState), /owner or an admin/, 'only the organization owner or an admin can connect a drive');

  const publishedBefore = await prisma.documentVersion.count({ where: { document: { step: { phase: { project_id: project.id } } } } });
  remote.failNext = 1;
  await drive.finishGoogle('code', state);
  const conn = await prisma.driveConnection.findUnique({ where: { organization_id: org.id } });
  ok(conn && conn.refresh_token_enc !== 'refresh-123' && !conn.refresh_token_enc.includes('refresh-123'), 'the drive access is stored encrypted');
  await drive.syncOrganization(org.id);
  let driveStatus = await drive.status(org.id);
  ok(driveStatus.connection.counts.synced === publishedBefore && driveStatus.connection.counts.failed === 0,
    `versions published before connecting are copied (${driveStatus.connection.counts.synced}/${publishedBefore}); the copy that failed once was retried`);
  ok(!('refresh_token_enc' in driveStatus.connection), 'the status never exposes the stored access');
  const root = remote.folders.find(f => f.name === 'APTISO');
  const orgFolder = remote.folders.find(f => f.parent === root.id);
  const projFolder = remote.folders.find(f => f.parent === orgFolder.id);
  ok(orgFolder.name === 'Test Org' && projFolder.name === 'E2E ISMS' && remote.folders.some(f => f.parent === projFolder.id && /^3 Security Documentation$/.test(f.name)),
    'folders: APTISO / organization / project / "3 Security Documentation" / document');
  ok(remote.files.every(f => f.mime === 'application/pdf' && / v\d+\.\d+\.pdf$/.test(f.name)), `files are the library PDFs, e.g. "${remote.files[0].name}"`);

  // A new version is copied as a new file in the same folders
  const foldersBefore = remote.folders.length;
  const dc = await prisma.documentInstance.findUnique({ where: { id: ldoc.id } });
  await docSvc.updateContent(ldoc.id, { content: { ...dc.content, content: [...dc.content.content, { type: 'paragraph', content: [{ type: 'text', text: 'v1.2 change' }] }] } }, lead.id);
  await libSvc.submit(ldoc.id, lead.id, 'Drive test');
  await new Promise(r => setTimeout(r, 300));
  await drive.syncOrganization(org.id);
  ok(remote.files.some(f => f.name.endsWith('v1.2.pdf')) && remote.folders.length === foldersBefore, 'a new version is copied as a new file; existing folders are reused');
  ok(remote.files.filter(f => f.name.includes(dc.title)).length >= 3, 'earlier versions stay in the drive (nothing is replaced or deleted)');

  remote.authBroken = true;
  await drive.syncOrganization(org.id).catch(() => undefined);
  await prisma.documentVersion.findFirst();
  const dcs = await prisma.documentInstance.findUnique({ where: { id: ldoc.id } });
  await docSvc.updateContent(ldoc.id, { content: { ...dcs.content, content: [...dcs.content.content, { type: 'paragraph', content: [{ type: 'text', text: 'v1.3' }] }] } }, lead.id);
  await libSvc.submit(ldoc.id, lead.id);
  await new Promise(r => setTimeout(r, 300));
  driveStatus = await drive.status(org.id);
  ok(driveStatus.connection.status === 'NEEDS_RECONNECT', 'revoked access marks the connection "reconnect needed"');
  ok((await prisma.documentInstance.findUnique({ where: { id: ldoc.id } })).status === 'PUBLISHED', 'publishing still works while the drive is unreachable');

  ok((await drive.disconnect(org.id, lead.id)).message.includes('stay in the drive') && remote.revoked && !(await prisma.driveConnection.findUnique({ where: { organization_id: org.id } })),
    'disconnecting revokes and deletes the stored access; copied files stay');

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  await app.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
