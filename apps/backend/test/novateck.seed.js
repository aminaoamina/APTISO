/*
 * Demo data: NovaTeck SARL, a 140-person SaaS payroll company in Tunis,
 * through the real services (every business rule applies). Phases 1 to 3
 * are finished, Phase 4 is set up; the internal audit, the first management
 * review, the Information Security Policy approval and Phase 5 are left for
 * the demo. E-mails are not sent while seeding (the bell still gets them).
 *
 * Run (dev database, backend .env):
 *   TS_NODE_TRANSPILE_ONLY=1 node -r ts-node/register test/novateck.seed.js
 * Running it again deletes NovaTeck and its seeded accounts first.
 */
const path = require('path');
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config({ quiet: true });
const argon2 = require('argon2');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../src/app.module');
const svc = {
  prisma: require('../src/prisma/prisma.service').PrismaService,
  projects: require('../src/projects/projects.service').ProjectsService,
  docs: require('../src/documents/documents.service').DocumentsService,
  library: require('../src/documents/library.service').LibraryService,
  requirements: require('../src/requirements/requirements.service').RequirementsService,
  risk: require('../src/risk-register/risk-register.service').RiskRegisterService,
  soa: require('../src/soa/soa.service').SoaService,
  policies: require('../src/policies/policies.service').PoliciesService,
  trainings: require('../src/audit-prep/trainings.service').TrainingsService,
  objectives: require('../src/audit-prep/objectives.service').ObjectivesService,
  improvement: require('../src/audit-prep/improvement.service').ImprovementService,
  audits: require('../src/audit-prep/internal-audit.service').InternalAuditService,
  reviews: require('../src/audit-prep/management-review.service').ManagementReviewService,
  mail: require('../src/mail/mail.service').MailService,
};

const ORG = 'NovaTeck';
const PASSWORD = 'NovaTeck#2026';
const mailOf = key => `info.aptiso+${key}@gmail.com`;

// Hichem (new developer) signs up on camera and Claire (external auditor) is invited: not seeded.
const PEOPLE = [
  { key: 'amina', first: 'Amina', last: 'Bayoudh', job: 'CISO', org: 'ORG_OWNER', project: 'PROJECT_LEAD', iso: ['INFORMATION_SECURITY_MANAGER'] },
  { key: 'karim', first: 'Karim', last: 'Ben Salah', job: 'CEO', org: 'ORG_ADMIN', project: 'PROJECT_MEMBER', iso: ['TOP_MANAGEMENT'] },
  { key: 'leila', first: 'Leila', last: 'Trabelsi', job: 'CFO', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['TOP_MANAGEMENT', 'DEPARTMENT_HEAD'] },
  { key: 'youssef', first: 'Youssef', last: 'Gharbi', job: 'IT Manager', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['IT_ADMINISTRATOR', 'ASSET_OWNER'] },
  { key: 'sarra', first: 'Sarra', last: 'Mansouri', job: 'DevOps Lead', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['IT_ADMINISTRATOR'] },
  { key: 'nour', first: 'Nour', last: 'Hamdi', job: 'Head of Engineering', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['DEPARTMENT_HEAD', 'ASSET_OWNER'] },
  { key: 'mehdi', first: 'Mehdi', last: 'Jaziri', job: 'HR Manager', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['DEPARTMENT_HEAD', 'ASSET_OWNER'] },
  { key: 'ines', first: 'Ines', last: 'Bouaziz', job: 'Legal Counsel & DPO', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['DEPARTMENT_HEAD'] },
  { key: 'omar', first: 'Omar', last: 'Chebbi', job: 'Finance Controller, Internal Auditor', org: 'ORG_MEMBER', project: 'PROJECT_AUDITOR', iso: ['INTERNAL_AUDITOR'] },
  { key: 'rania', first: 'Rania', last: 'Feki', job: 'Customer Support Agent', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['EMPLOYEE'] },
];

const log = (...a) => console.log('  ', ...a);

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const s = Object.fromEntries(Object.entries(svc).map(([k, v]) => [k, app.get(v)]));
  const { prisma } = s;
  let mails = 0;
  s.mail.transporter.sendMail = async () => { mails++; return { messageId: 'seed', accepted: [], rejected: [] }; };

  // ── Clean a previous run ──
  const old = await prisma.organization.findMany({ where: { name: ORG } });
  for (const o of old) await prisma.organization.delete({ where: { id: o.id } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'info.aptiso+' } } });

  // ── People and organization ──
  const password_hash = await argon2.hash(PASSWORD);
  const u = {};
  for (const p of PEOPLE) {
    u[p.key] = await prisma.user.create({
      data: { email: mailOf(p.key), first_name: p.first, last_name: p.last, job_title: p.job, timezone: 'Africa/Tunis', password_hash, is_active: true, is_email_verified: true },
    });
  }
  const id = k => u[k].id;
  const org = await prisma.organization.create({
    data: {
      name: ORG, industry: 'Software (SaaS payroll and HR)', created_by: id('amina'),
      description: 'NovaTeck SARL, Tunis. NovaPay: SaaS payroll and HR platform for about 300 client companies in Tunisia, France and Belgium.',
      members: { create: PEOPLE.map(p => ({ user_id: id(p.key), role: p.org })) },
    },
  });
  const fw = await prisma.complianceFramework.findFirst({ where: { status: 'AVAILABLE' } });
  const project = await s.projects.create(org.id, {
    name: 'NovaTeck ISMS 2026-2027', framework_id: fw.id, start_date: '2026-09-01', target_date: '2027-06-30',
    description: 'ISO/IEC 27001:2022 certification of the NovaPay platform and the Tunis head office. Certification audit planned for June 2027.',
  }, id('amina'), 'ORG_OWNER');
  for (const p of PEOPLE.slice(1)) {
    const m = await prisma.projectMember.create({ data: { project_id: project.id, user_id: id(p.key), privilege: p.project } });
    await prisma.projectMemberIsoRole.createMany({ data: p.iso.map(r => ({ project_member_id: m.id, iso_role: r })) });
  }
  const leadMember = await prisma.projectMember.findFirst({ where: { project_id: project.id, user_id: id('amina') } });
  await prisma.projectMemberIsoRole.create({ data: { project_member_id: leadMember.id, iso_role: 'INFORMATION_SECURITY_MANAGER' } });
  log(`organization ${ORG}, project "${project.name}", ${PEOPLE.length} people`);

  const steps = await prisma.projectStep.findMany({ where: { phase: { project_id: project.id } }, select: { id: true, key: true, title: true } });
  const step = key => { const st = steps.find(x => x.key === key); if (!st) throw new Error(`no step ${key}`); return st.id; };
  const LEAD = id('amina');

  /** Owner = CISO, approver = CEO; submitted by the CISO and approved by the CEO unless `pending`. */
  const publish = async (docId, note = 'First issue', { pending = false, approver = 'karim' } = {}) => {
    await s.docs.updateAssignments(docId, { owner_id: LEAD, approver_id: id(approver), update_interval: 12 }, LEAD);
    await s.library.submit(docId, LEAD, note);
    if (!pending) await s.library.approve(docId, id(approver));
  };
  const finish = async (stepId, title) => {
    // A register step's generated document goes to the library first (clause 7.5.3).
    const doc = await prisma.documentInstance.findUnique({ where: { step_id: stepId }, include: { _count: { select: { versions: true } } } });
    if (doc && !doc._count.versions && doc.status === 'DRAFT') await publish(doc.id);
    await s.projects.completeStep(project.id, stepId, LEAD, 'PROJECT_LEAD');
    log(`✔ ${title}`);
  };
  const wizard = async (key, answers, opts) => {
    const doc = await s.docs.createFromWizard(project.id, step(key), { answers }, LEAD, 'PROJECT_LEAD');
    await publish(doc.id, 'First issue', opts);
    return doc;
  };
  const control = { company_name: 'NovaTeck SARL', author: LEAD, approver: id('karim'), confidentiality_level: 'Internal' };

  // ════════════ PHASE 1: Project preparation ════════════
  console.log('Phase 1');
  await finish(step('iso27001.p1s1.intro'), 'Introduction');

  await wizard('iso27001.p1s2.doc-control', {
    ...control, document_code: 'NT-ISMS-PRO-01', validity_date: '2026-10-01', document_owner: 'CISO', review_frequency: 'Every 12 months',
    applicability: 'Information security documentation only',
    reference_documents: 'ISO/IEC 27001:2022 clause 7.5; Information Security Policy (NT-ISMS-POL-01)',
    formatting_standard: 'Documents are written in English in the NovaTeck Word template (Calibri 11, logo in the header). The first page shows the code, version, owner and classification. Codes follow NT-ISMS-<type>-<number>: POL for policies, PRO for procedures, PLN for plans, REG for registers and REC for records.',
    approval_responsibility: 'Policies, the Statement of Applicability and the risk treatment plan are approved by the CEO. Procedures and plans are approved by the CISO. Registers and records are kept up to date by their owner and need no formal approval.',
    approval_method: 'Status change in APTISO',
    publishing_role: 'CISO',
    publishing_method: 'Approved documents are published in APTISO and copied as PDF to the SharePoint site "NovaTeck ISMS", read-only for staff.',
    distribution_role: 'Information Security Manager',
    notification_method: 'A post in the Microsoft Teams channel #security-news and an e-mail to the persons concerned. Policies for all staff are also presented at the monthly all-hands meeting.',
    obsolete_handling: 'Previous versions stay in the APTISO library marked as superseded and are removed from SharePoint. Printed copies are destroyed by the document owner.',
    external_register_location: 'SharePoint "NovaTeck ISMS" > External documents register',
    record_name: 'ISMS records: training records, audit reports, management review minutes, incident reports and logs',
    record_storage_location: 'APTISO and SharePoint "NovaTeck ISMS" > Records',
    record_responsible: 'Information Security Manager',
    record_protection: 'Access limited to the ISMS team and the record owners in Microsoft 365, SharePoint versioning and 93-day recycle bin, daily backup of Microsoft 365.',
    record_retention: '3 years, or longer when a law or a client contract requires it',
  });
  await finish(step('iso27001.p1s2.doc-control'), 'Procedure for Document and Record Control (approved by the CEO)');

  await wizard('iso27001.p1s3.project-plan', {
    ...control, document_code: 'NT-ISMS-PLN-01', validity_date: '2026-09-15', document_owner: 'CISO', update_period: 'Every 3 months during the project',
    purpose_scope: 'This plan defines the objectives, responsibilities, deadlines and resources of the ISO/IEC 27001:2022 implementation project at NovaTeck. It applies to the project team and to every manager who takes part in the project.',
    reference_documents: 'ISO/IEC 27001:2022; ISMS Scope Document; Information Security Policy',
    top_management_designation: 'Executive Committee (CEO and CFO)',
    target_date: '2027-06-30',
    project_results: 'Procedure for Document and Record Control; Register of requirements; ISMS Scope; Information Security Policy; Risk Assessment and Treatment Methodology; Risk Register and Risk Treatment Plan; Statement of Applicability; the security policies required by the SoA; Training plan; Security objectives; Internal audit report; Management review minutes.',
    deadlines_overview: 'Phase 1 Project preparation: 31 October 2026. Phase 2 Risk management: 30 November 2026. Phase 3 Security documentation: 31 January 2027. Phase 4 Internal audit and management review: 31 March 2027. Certification audit stage 1: May 2027, stage 2: June 2027.',
    project_sponsor: id('karim'), project_manager: LEAD,
    team_members: 'Amina Bayoudh (CISO, project manager), Youssef Gharbi (IT Manager), Sarra Mansouri (DevOps Lead), Nour Hamdi (Head of Engineering), Mehdi Jaziri (HR Manager), Ines Bouaziz (Legal Counsel & DPO), Leila Trabelsi (CFO), Omar Chebbi (internal auditor).',
    project_risks: 'Key engineers are busy with the NovaPay 4.0 release in Q1 2027; the budget for tools and certification is not confirmed yet; Customer Support may resist new rules (MFA, clean desk); evidence depends on AWS and Microsoft reports.',
    risk_controls: '10% of Engineering sprint capacity reserved for the project; budget presented to the Executive Committee in November 2026; an awareness session before each new rule; monthly steering meeting chaired by the CEO.',
    storage_folder: 'SharePoint "NovaTeck ISMS" > Project',
    record_storage_period: '3 years after the end of the project',
    est_workload_hours: '600', est_completion_days: '270',
  });
  await finish(step('iso27001.p1s3.project-plan'), 'Project Plan');

  await wizard('iso27001.p1s4.req-identification', {
    ...control, document_code: 'NT-ISMS-PRO-02', validity_date: '2026-10-01', document_owner: 'Legal Counsel & DPO', update_period: 'Every 12 months',
    compliance_job_title: 'Legal Counsel & DPO',
    publishing_guidelines: 'The register is updated within 30 days of any new law, regulation or client contract that affects information security, and reviewed every 6 months.',
  });
  await finish(step('iso27001.p1s4.req-identification'), 'Procedure for Identification of Requirements');

  const legalStep = step('iso27001.p1s5.legal-requirements');
  const REQUIREMENTS = [
    { requirement_type: 'LEGAL_REGULATORY', status: 'COMPLIANT', responsible_person_id: id('ines'), related_area: 'Personal data protection', country: 'European Union',
      interested_party: 'Clients in France and Belgium and their employees; CNIL and the Belgian Data Protection Authority',
      description: 'As a processor of client employees personal data: data processing agreement with each client, record of processing activities, security of processing (art. 32), notification of personal data breaches to the client without undue delay, transfers outside the EU only with safeguards.',
      document_stipulating: 'Regulation (EU) 2016/679 (GDPR)', date_of_document: '2016-04-27', valid_from: '2018-05-25', link: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
    { requirement_type: 'LEGAL_REGULATORY', status: 'NON_COMPLIANT', responsible_person_id: id('ines'), related_area: 'Personal data protection', country: 'Tunisia', deadline: '2026-12-31',
      interested_party: 'INPDP (Instance Nationale de Protection des Données Personnelles), employees and Tunisian clients',
      description: 'Declare the processing of personal data to the INPDP and obtain its authorisation before transferring personal data abroad. The declaration of the transfer to AWS eu-west-3 (Paris) is still in progress.',
      document_stipulating: 'Organic Law No. 2004-63 of 27 July 2004 on the protection of personal data', date_of_document: '2004-07-27', valid_from: '2004-07-27' },
    { requirement_type: 'LEGAL_REGULATORY', status: 'COMPLIANT', responsible_person_id: id('leila'), related_area: 'Accounting records', country: 'Tunisia',
      interested_party: 'Tax administration, statutory auditor',
      description: 'Keep accounting documents and supporting records (invoices, payroll accounting of NovaTeck staff) for 10 years.',
      document_stipulating: 'Tunisian Commercial Code, article 15', valid_from: '1959-10-05' },
    { requirement_type: 'LEGAL_REGULATORY', status: 'COMPLIANT', responsible_person_id: id('ines'), related_area: 'Electronic documents', country: 'Tunisia',
      interested_party: 'Client companies and their employees (electronic payslips)',
      description: 'Electronic documents (payslips, bank transfer files) must keep their integrity and the identity of their author; electronic signatures are used for transfer files sent to banks.',
      document_stipulating: 'Law No. 2000-83 of 9 August 2000 on electronic exchanges and commerce', date_of_document: '2000-08-09', valid_from: '2000-08-09' },
    { requirement_type: 'CONTRACTUAL', status: 'NON_COMPLIANT', responsible_person_id: LEAD, related_area: 'Client contracts', deadline: '2027-03-31',
      interested_party: 'Client companies (NovaPay subscription agreement v3, security annex)',
      description: 'Notify security incidents affecting client data within 48 hours; 99.9% monthly availability; yearly penetration test report on request; client data deleted within 90 days after the end of the contract. The first external penetration test is planned for Q1 2027.',
      document_stipulating: 'NovaPay subscription agreement v3, Annex 2 (Security)', date_of_document: '2025-01-01', valid_from: '2025-01-01' },
    { requirement_type: 'CONTRACTUAL', status: 'NON_COMPLIANT', responsible_person_id: id('karim'), related_area: 'Sales', deadline: '2027-06-30',
      interested_party: 'Two French banks (tenders of September and October 2026)',
      description: 'ISO/IEC 27001 certification of the service is required before the contract is signed; until then a completed security questionnaire and the project plan are accepted.',
      document_stipulating: 'Tender specifications, section 7 (Information security)', date_of_document: '2026-09-15' },
    { requirement_type: 'CONTRACTUAL', status: 'COMPLIANT', responsible_person_id: id('sarra'), related_area: 'Cloud hosting',
      interested_party: 'Amazon Web Services (AWS)',
      description: 'Shared responsibility: NovaTeck is responsible for security in the cloud (identity and access management, encryption, network configuration, backups, logging) for the NovaPay accounts.',
      document_stipulating: 'AWS Customer Agreement and the AWS Shared Responsibility Model', link: 'https://aws.amazon.com/agreement/' },
    { requirement_type: 'OTHER', status: 'COMPLIANT', responsible_person_id: id('leila'), related_area: 'Payments',
      interested_party: 'Payment service provider for subscription payments',
      description: 'PCI DSS does not apply: NovaPay does not store, process or transmit card data. Subscription card payments are handled entirely by the payment provider page.',
      document_stipulating: 'PCI DSS v4.0 (assessed as not applicable)' },
  ];
  for (const r of REQUIREMENTS) await s.requirements.create(legalStep, r, LEAD, 'PROJECT_LEAD');
  const legalDoc = await s.requirements.createDocument(legalStep, LEAD, 'PROJECT_LEAD');
  await publish((legalDoc.document ?? legalDoc).id);
  await finish(legalStep, `Register of requirements (${REQUIREMENTS.length} requirements, 3 not met yet)`);

  await wizard('iso27001.p1s6.isms-scope', {
    ...control, document_code: 'NT-ISMS-DOC-01', validity_date: '2026-10-15', document_owner: 'CISO', review_frequency: 'Every 12 months',
    job_titles: 'All NovaTeck employees and contractors who have access to NovaPay or to client data: Engineering, Product, IT & DevOps, Customer Support, Human Resources, Finance and Legal staff.',
    departments: 'Management, Engineering, Product, IT & DevOps, Customer Support, Human Resources, Finance, Legal & Compliance (Tunis head office).',
    processes: 'Design, development, hosting, operation and support of the NovaPay SaaS payroll and HR platform; processing of client employees personal and salary data; preparation of bank transfer files; the HR and finance processes that support them.\n'
      + 'Internal issues (clause 4.1): fast growth from 80 to 140 employees in two years; dependence on a DevOps team of 3 people; the NovaPay 4.0 release in 2027.\n'
      + 'External issues: GDPR and Tunisian Organic Law 2004-63; banks requiring ISO/IEC 27001 in their tenders; ransomware attacks targeting payroll providers; reliance on AWS and Microsoft.\n'
      + 'Interested parties (clause 4.2): client companies and their employees, banks, INPDP and CNIL, AWS and Microsoft, NovaTeck employees, shareholders.',
    locations: 'Head office, Les Berges du Lac 2, Tunis, Tunisia (offices and server room); AWS region eu-west-3 (Paris) for NovaPay production; employees working from home in Tunisia.',
    it_infrastructure: 'NovaPay production and staging on AWS (EKS, RDS PostgreSQL, S3); self-managed GitLab on AWS for source code and CI/CD; Microsoft 365 (Exchange, SharePoint, Teams, Intune); Windows and macOS laptops managed with Intune; office network, firewall and Wi-Fi; the server room with the domain controller and the backup NAS.',
    exclusions: 'The Paris sales office (6 people, no access to production or to client payroll data) and the marketing website (hosted by an agency, no client data). Interfaces: Paris staff use Microsoft 365 under the same policies; the website only links to the NovaPay login page.',
  });
  await finish(step('iso27001.p1s6.isms-scope'), 'ISMS Scope (with internal/external issues and interested parties)');

  await wizard('iso27001.p1s7.security-policy', {
    ...control, document_code: 'NT-ISMS-POL-01', validity_date: '2026-10-15', document_owner: 'CISO', review_frequency: 'Every 12 months',
    reference_documents: 'ISO/IEC 27001:2022; ISMS Scope Document; Statement of Applicability; Risk Assessment and Treatment Methodology',
    security_objectives: 'Protect the confidentiality of client payroll and personal data; keep NovaPay available at least 99.9% of the time each month; detect and handle every security incident within the deadlines of client contracts; obtain ISO/IEC 27001 certification by June 2027.',
    objectives_reviewer: id('karim'), objectives_review_frequency: 'Every 6 months',
    measurement_methodology_person: LEAD, measurement_reporting_person: id('youssef'),
    security_manager_title: 'CISO', top_executive_title: 'CEO', training_awareness_title: 'HR Manager',
    incident_receiver: 'Information Security Manager, through the IT service desk or the #security Teams channel',
    security_communicator: 'CISO', policy_communicator: 'HR Manager',
  }, { pending: true });
  log('… Information Security Policy sent to Karim (CEO) for approval: approve it on camera');

  await finish(step('iso27001.p1s8.security-awareness'), 'Information Security Awareness');

  // ════════════ PHASE 2: Risk management ════════════
  console.log('Phase 2');
  await wizard('iso27001.p2s1.risk-methodology', {
    ...control, document_code: 'NT-ISMS-PRO-03', validity_date: '2026-10-20', document_owner: 'CISO', review_frequency: 'Every 12 months',
    risk_management_coordinator: 'Information Security Manager',
    reference_documents: 'ISO/IEC 27001:2022 clauses 6.1.2 and 6.1.3; ISO/IEC 27005:2022',
    security_manager_title: 'CISO', top_executive_title: 'CEO',
    risk_documents_storage: 'APTISO and SharePoint "NovaTeck ISMS" > Risk management',
    retention_period: '3 years',
  });
  await finish(step('iso27001.p2s1.risk-methodology'), 'Risk Assessment and Treatment Methodology');

  const rrStep = step('iso27001.p2s2.risk-register');
  const C = {
    NOVAPAY: 'NovaPay production platform (AWS eu-west-3)', GITLAB: 'GitLab source code and CI/CD', M365: 'Microsoft 365 tenant (mail, SharePoint, Teams)', PAYFILES: 'Client payroll and bank transfer files',
    DB: 'Databases', DEV: 'Internally developed software', PDATA: 'Personal data (e.g., from employees or customers)', LAPTOPS: 'Mobile devices (e.g., laptops, notebooks, tablets, smartphones, PDAs)',
    NET: 'Network equipment (e.g., firewalls, routers and switches)', ROOM: 'Server room or datacenter', SAAS: 'Third-party services used over the Internet (e.g., SaaS)',
    EXPERTS: 'Employees with specific expertise (e.g., system administrators, designers, software developers, security experts, etc.)', REMOTE: 'Remote employees',
    FREELANCE: 'Outsourced personnel (e.g., freelancers or contractors)', LOGS: 'Records and logs',
  };
  // asset, vulnerability, threat, impact, likelihood (0-2, level = sum, > 2 is treated), risk owner, controls, treatment, existing controls
  const RISKS = [
    [C.DB, 'Backup does not exist or is not regularly performed', 'Infection with malicious software (e.g., virus, trojan, etc.)', 2, 1, 'sarra', ['A.8.13', 'A.5.30'], 'Daily encrypted RDS snapshots copied to a second AWS region and a quarterly restore test.', 'Daily RDS snapshots in the same region, never restored.'],
    [C.DB, 'Backup does not exist or is not regularly performed', 'Equipment failure', 2, 1, 'sarra', ['A.8.13', 'A.8.14'], 'Multi-AZ RDS and a second backup copy in another region.', 'Daily snapshots in the same region.'],
    [C.NOVAPAY, 'Software misconfiguration', 'Access to information system with malicious intent', 2, 1, 'nour', ['A.8.9', 'A.8.20', 'A.8.16'], 'Configuration baseline in Terraform, AWS Config rules and alerts on changes; monitoring of the API gateway.', 'Infrastructure as code for most resources.'],
    [C.NOVAPAY, 'Software misconfiguration', 'Denial of service attack', 2, 1, 'sarra', ['A.8.6', 'A.8.20'], 'AWS WAF rate limiting and AWS Shield Standard on the public endpoints; auto-scaling limits reviewed.', 'CloudFront in front of the API.'],
    [C.NOVAPAY, 'Access rights are granted beyond what is necessary', 'Data / information theft', 2, 1, 'youssef', ['A.5.15', 'A.5.18', 'A.8.2'], 'Role-based access to AWS and the NovaPay back-office; quarterly access review signed by the managers.', 'Access granted on request by e-mail.'],
    [C.NOVAPAY, 'No deactivation of user accounts after termination of employment', 'Access to information system with malicious intent', 2, 1, 'mehdi', ['A.5.18', 'A.6.5'], 'HR leaver checklist triggers removal of all accounts on the last day, checked by IT.', 'Accounts removed when IT is told.'],
    [C.DEV, 'Requirements for software development not clearly defined', 'Application error', 1, 2, 'nour', ['A.8.25', 'A.8.26', 'A.8.29'], 'Security requirements in every user story template; security tests in the CI pipeline before release.', 'Code review on every merge request.'],
    [C.DEV, 'Inadequate change control of software and its databases', 'Use of unauthorized or untested code with malicious intent', 2, 1, 'nour', ['A.8.32', 'A.8.31', 'A.8.4'], 'Protected main branch, two approvals per merge request, deployment to production only from the pipeline.', 'One approval per merge request.'],
    [C.GITLAB, 'Weak passwords', 'Malicious disclosure of passwords', 2, 1, 'sarra', ['A.5.17', 'A.8.5'], 'Single sign-on with Microsoft Entra ID and mandatory MFA for GitLab and AWS.', 'Local GitLab accounts, MFA optional.'],
    [C.PDATA, 'Wrong understanding about the sensitivity of information', 'Unintentional disclosure of data / information', 2, 1, 'ines', ['A.5.12', 'A.5.13', 'A.5.34'], 'Classification scheme with labels in Microsoft 365, privacy training for Support and Engineering.', 'GDPR clauses in client contracts.'],
    [C.PAYFILES, 'Uncontrolled copying of documents and data', 'Malicious leakage/disclosure of information', 2, 1, 'ines', ['A.8.12', 'A.5.10', 'A.8.11'], 'Data loss prevention rules in Microsoft 365, masking of salaries in support tools, USB storage blocked by Intune.', 'Files exchanged through the NovaPay portal.'],
    [C.LAPTOPS, 'Downloads from Internet not controlled', 'Infection with malicious software (e.g., virus, trojan, etc.)', 1, 2, 'youssef', ['A.8.7', 'A.8.1'], 'Microsoft Defender for Endpoint on all laptops, application control for non-developers.', 'Windows Defender with default settings.'],
    [C.LAPTOPS, 'Mobile equipment improperly attended', 'Theft, vandalism, or sabotage', 1, 1, 'youssef', [], null, 'BitLocker and FileVault encryption, automatic screen lock after 5 minutes.'],
    [C.NET, 'Wrong configuration of network access', 'Access to network with malicious intent', 2, 1, 'youssef', ['A.8.20', 'A.8.22'], 'Separate VLANs for staff, guests and the server room; firewall rules reviewed every 6 months.', 'One flat office network with a guest Wi-Fi.'],
    [C.ROOM, 'Lack of/inadequate maintenance', 'Interruption of power supply from public network', 1, 1, 'youssef', [], null, 'UPS for 30 minutes; production runs on AWS, not in the server room.'],
    [C.SAAS, 'Lack of formal agreements', 'Errors or interruption of service of third-party providers', 2, 1, 'leila', ['A.5.19', 'A.5.20', 'A.5.22'], 'Security requirements and SLAs in every supplier contract; yearly review of critical suppliers.', 'Standard terms of the providers.'],
    [C.M365, 'Lack of control on where third-party stores information', 'Data / information theft', 1, 1, 'youssef', [], null, 'Microsoft 365 data stored in the EU (France) data centres.'],
    [C.EXPERTS, 'Inadequate level of knowledge and/or awareness', 'Social engineering', 2, 1, 'mehdi', ['A.6.3', 'A.5.24'], 'Yearly awareness training, phishing simulations every quarter, a clear reporting channel.', 'Onboarding presentation only.'],
    [C.REMOTE, 'Rules for working off-premises not clearly defined', 'Unintentional disclosure of data / information', 1, 2, 'mehdi', ['A.6.7', 'A.8.1'], 'Remote working policy (VPN, no public Wi-Fi without VPN, privacy screens) signed by every remote employee.', 'Laptops encrypted.'],
    [C.FREELANCE, 'Inadequate supervision of external suppliers', 'Attack through outsourced equipment/service (compromising supply chain)', 2, 1, 'nour', ['A.5.21', 'A.6.6', 'A.5.19'], 'NDA and security clauses for every freelancer, access only to the repositories they need, accounts expire with the contract.', 'NDA signed by freelancers.'],
    [C.LOGS, 'Lack of / poor internal audit of documents and data', 'Change, destruction or falsification of records with malicious intent', 1, 1, 'sarra', [], null, 'CloudTrail enabled on all AWS accounts.'],
  ];
  const assets = [...new Set(RISKS.map(r => r[0]))];
  const custom = { [C.NOVAPAY]: 'SOFTWARE_DATABASE', [C.GITLAB]: 'SOFTWARE_DATABASE', [C.M365]: 'THIRD_PARTY', [C.PAYFILES]: 'DOCUMENTS_DATA' };
  let reg = await s.risk.saveAssets(rrStep, { assetNames: assets.filter(a => !custom[a]), customAssets: assets.filter(a => custom[a]).map(name => ({ name, category: custom[name] })) }, LEAD);
  const assetId = n => reg.assets.find(a => a.name === n).id;
  const byAsset = {};
  for (const [a, v] of RISKS) (byAsset[assetId(a)] ??= new Set()).add(v);
  reg = await s.risk.saveVulnerabilities(rrStep, { vulnerabilitiesByAsset: Object.fromEntries(Object.entries(byAsset).map(([k, v]) => [k, [...v]])) }, LEAD);
  const vulnId = n => reg.vulnerabilities.find(v => v.name === n).id;
  const byPair = {};
  for (const [a, v, t] of RISKS) (byPair[`${assetId(a)}:${vulnId(v)}`] ??= []).push(t);
  reg = await s.risk.saveThreats(rrStep, { threatsByAssetVulnerability: byPair }, LEAD);
  const DEPARTMENTS = { sarra: 'IT & DevOps', youssef: 'IT & DevOps', nour: 'Engineering', mehdi: 'Human Resources', ines: 'Legal & Compliance', leila: 'Finance' };
  for (const r of reg.risks) {
    const def = RISKS.find(([a, v, t]) => a === r.asset.name && v === r.vulnerability.name && t === r.threat.name);
    if (!def) throw new Error(`unexpected risk ${r.asset.name} / ${r.vulnerability.name} / ${r.threat.name}`);
    const [, , , impact, likelihood, owner, controls, treatment, existing] = def;
    await s.risk.updateRisk(r.id, { impact, likelihood, risk_owner_id: id(owner), asset_owner_id: id(owner), department: DEPARTMENTS[owner], existing_controls: existing }, LEAD);
    // Acceptable risks (level <= 2) need no treatment.
    if (controls.length) {
      await s.risk.updateRisk(r.id, { treatment_option: 'DECREASE', treatment_controls: controls, treatment_description: treatment, residual_impact: Math.max(impact - 1, 1), residual_likelihood: 0 }, LEAD);
      await s.risk.confirmTreatment(r.id, LEAD);
    }
  }
  reg = await s.risk.reviewRisks(rrStep, { riskIds: reg.risks.map(r => r.id) }, LEAD);
  for (const r of reg.risks) await s.risk.approveRisk(r.id, { approval_decision: 'APPROVED' }, r.risk_owner_id ?? r.risk_owner?.id);
  await s.projects.confirmTraining(project.id, rrStep, { rows: ['youssef', 'nour', 'mehdi', 'ines', 'leila'].map(k => ({ user_id: id(k), skills: 'Assessing and treating risks with the NovaTeck methodology', training: 'Risk owner workshop by the CISO (2 hours)' })) }, LEAD, 'PROJECT_LEAD');
  await s.risk.createDocuments(rrStep, LEAD);
  await finish(rrStep, `Risk Register (${assets.length} assets, ${reg.risks.length} risks, approved by their owners)`);

  const soaStep = step('iso27001.p2s3.statement-of-applicability');
  let soa = await s.soa.getSoa(soaStep, LEAD);
  soa = await s.soa.saveSetup(soaStep, { answers: Object.fromEntries(soa.setup.questions.map(q => [q.key, true])) }, LEAD);
  const PLANNED = {
    'A.8.13': ['sarra', '2026-12-15', 'Second backup copy in another AWS region (about 150 EUR per month)'],
    'A.5.17': ['youssef', '2026-11-30', 'Microsoft Entra ID P1 licences for MFA and conditional access (about 6 EUR per user per month)'],
    'A.8.16': ['sarra', '2027-01-31', 'Centralised log monitoring service (about 400 EUR per month)'],
    'A.6.3': ['mehdi', '2026-12-31', 'Security awareness e-learning and phishing simulation platform (about 2,500 EUR per year)'],
    'A.8.8': ['nour', '2027-02-28', 'External penetration test of NovaPay (about 8,000 EUR)'],
    'A.5.19': ['leila', '2027-01-15', null],
    'A.5.12': ['ines', '2026-12-31', null],
    'A.5.18': ['youssef', '2026-11-30', null],
    'A.6.7': ['mehdi', '2026-12-15', null],
  };
  for (const r of soa.rows.filter(r => r.applicable)) {
    await prisma.soaControl.update({ where: { id: r.id }, data: { status: PLANNED[r.control.code] ? 'PLANNED' : 'IMPLEMENTED' } });
  }
  for (const [code, [who, deadline, resources]] of Object.entries(PLANNED)) {
    const row = soa.rows.find(r => r.control.code === code);
    if (!row?.applicable) continue;
    await s.soa.updateControl(row.id, { responsible_id: id(who), deadline, ...(resources && { resources }) }, LEAD);
  }
  await s.soa.confirmTreatmentPlan(soaStep, LEAD);
  for (const [code, [, , resources]] of Object.entries(PLANNED)) {
    if (resources) await s.soa.decideResources(soa.rows.find(r => r.control.code === code).id, { decision: 'APPROVED', comment: 'Approved by the Executive Committee on 12 October 2026' }, id('karim'));
  }
  const owners = [...new Set(reg.risks.map(r => r.risk_owner_id ?? r.risk_owner?.id))];
  for (const o of owners) await s.soa.ownerApproval(soaStep, { decision: 'APPROVED', comment: 'Residual risks accepted.' }, o);
  await s.projects.confirmTraining(project.id, soaStep, { rows: [{ user_id: id('sarra'), skills: 'Securing AWS accounts (IAM, logging, backups)', training: 'AWS security fundamentals course (online, 2 days)' }] }, LEAD, 'PROJECT_LEAD');
  await s.soa.createDocument(soaStep, LEAD);
  soa = await s.soa.getSoa(soaStep, LEAD);
  await finish(soaStep, `Statement of Applicability (${soa.rows.filter(r => r.applicable).length}/93 applicable, ${Object.keys(PLANNED).length} planned, resources approved by the CEO)`);

  // ════════════ PHASE 3: Security documentation ════════════
  console.log('Phase 3');
  await s.policies.syncFromSoa(soaStep, LEAD);
  const phase3 = await prisma.projectStep.findMany({ where: { phase: { project_id: project.id, order: 3 } }, orderBy: { order: 'asc' } });
  for (const p of phase3) {
    if (p.metadata_json?.required === false) continue;
    const draft = await s.policies.createDraft(p.id, LEAD);
    await publish(draft.id);
    await finish(p.id, p.title);
  }

  // ════════════ PHASE 4: Preparation for the external audit (set up) ════════════
  console.log('Phase 4');
  const p4 = await prisma.projectStep.findMany({ where: { phase: { project_id: project.id, order: 4 } }, orderBy: { order: 'asc' } });
  const p4id = part => p4.find(x => x.key.includes(part)).id;
  for (const part of ['nonconformity-procedure', 'internal-audit-procedure']) {
    const draft = await s.policies.createDraft(p4id(part), LEAD);
    await publish(draft.id);
    await finish(p4id(part), p4.find(x => x.key.includes(part)).title);
  }

  const trStep = p4id('training-plan');
  await s.trainings.importNeeds(trStep, LEAD);
  const everyone = PEOPLE.map(p => id(p.key));
  for (const t of [
    { title: 'Information security awareness for all staff', skills: 'The Information Security Policy, classification, phishing, passwords and MFA, reporting incidents', participant_ids: everyone, method: 'Classroom session and e-learning', provider: 'CISO', planned_date: '2026-11-20' },
    { title: 'ISO/IEC 27001 internal auditor course', skills: 'Planning and performing internal audits (ISO 19011), writing findings', participant_ids: [id('omar')], method: 'External course (3 days)', provider: 'Accredited training body', planned_date: '2026-12-07' },
    { title: 'Secure coding (OWASP Top 10)', skills: 'Preventing injection, broken access control and other OWASP Top 10 flaws in NovaPay code', participant_ids: [id('nour'), id('sarra')], method: 'Workshop (1 day)', provider: 'External trainer', planned_date: '2027-01-12' },
    { title: 'Phishing and social engineering for Customer Support', skills: 'Recognising phishing and fake client requests, verifying callers before sharing payroll data', participant_ids: [id('rania'), id('mehdi')], method: 'Workshop and simulation', provider: 'CISO', planned_date: '2026-11-05' },
  ]) await s.trainings.create(trStep, t, LEAD);
  let tr = await s.trainings.get(trStep, LEAD);
  for (const t of tr.trainings) await s.trainings.approve(trStep, t.id, id('karim'));
  const kickoff = await s.trainings.create(trStep, { title: 'ISMS kick-off for managers', skills: 'Purpose of the ISMS, roles and responsibilities, project plan', participant_ids: ['karim', 'leila', 'youssef', 'sarra', 'nour', 'mehdi', 'ines', 'omar'].map(id), method: 'Meeting (2 hours)', provider: 'CISO', planned_date: '2026-09-10' }, LEAD);
  const kick = (kickoff.trainings ?? (await s.trainings.get(trStep, LEAD)).trainings).find(t => t.title === 'ISMS kick-off for managers');
  await s.trainings.approve(trStep, kick.id, id('karim'));
  await s.trainings.update(trStep, kick.id, { status: 'PERFORMED', performed_date: '2026-09-10', evidence: 'Attendance sheet signed by the 8 participants (SharePoint > Records > Trainings)', effectiveness: 'Every manager named their role in the project correctly in the follow-up quiz.' }, LEAD);
  await s.trainings.createDocument(trStep, LEAD);
  await finish(trStep, 'Training plan (one training performed, the others planned and approved)');

  const objStep = p4id('security-objectives');
  await s.objectives.get(objStep, LEAD); // seeds the 8 default objectives
  await s.objectives.confirm(objStep, id('karim'));
  const ob = await s.objectives.get(objStep, LEAD);
  await s.objectives.addMeasurement(objStep, ob.objectives[0].id, { measured_on: '2026-09-30', result: 'Baseline measured for Q3 2026', achieved: false }, LEAD);
  await s.objectives.createDocument(objStep, LEAD);
  await finish(objStep, 'Security objectives (approved by the CEO)');

  const setupStep = p4id('management-review-setup');
  const su = await s.reviews.getSetup(setupStep, LEAD);
  await s.reviews.saveSetup(setupStep, { frequency: 'YEARLY', next_review_date: '2027-02-15', reviewer_ids: [id('karim'), id('leila'), LEAD], items: su.setup.items }, id('karim'));
  await finish(setupStep, 'Management review setup (first review 15 February 2027)');

  await s.audits.create(p4id('p4s6.internal-audit'), { title: 'Internal audit 2027: full ISMS', start_date: '2027-01-18', end_date: '2027-01-20', lead_auditor_id: id('omar') }, LEAD);
  log('… Internal audit planned 18-20 January 2027, lead auditor Omar: perform it on camera');

  // Registers: what really happened since September
  let ir = await s.improvement.createIncident(project.id, { title: 'Phishing e-mail impersonating a client HR manager', description: 'A support agent received an e-mail asking to export the payslips of a client company. She opened the link but did not enter her password, and reported it in #security.', occurred_at: '2026-09-22', severity: 'MEDIUM', affects_confidentiality: true, responsible_id: LEAD }, id('rania'));
  await s.improvement.updateIncident(project.id, ir.incidents[0].id, { is_security_incident: true, assessment: 'No credentials entered, mailbox scanned by Defender, no compromise found. The sender domain was blocked.', status: 'ASSESSED' }, LEAD);
  ir = await s.improvement.createIncident(project.id, { title: 'NovaPay unavailable for 47 minutes', description: 'The TLS certificate of the API gateway expired at 08:12; clients could not log in until 08:59.', occurred_at: '2026-10-06', severity: 'HIGH', affects_availability: true, responsible_id: id('sarra') }, id('sarra'));
  const outage = ir.incidents.find(i => i.title.startsWith('NovaPay unavailable'));
  await s.improvement.updateIncident(project.id, outage.id, { is_security_incident: true, assessment: 'Availability incident, monthly SLA still met (99.89%). Clients informed by the status page.', status: 'ASSESSED' }, LEAD);
  ir = await s.improvement.nonconformityFromIncident(project.id, outage.id, LEAD);
  const ncOutage = ir.nonconformities.find(n => n.incident_id === outage.id);
  await s.improvement.updateNonconformity(project.id, ncOutage.id, { correction: 'Certificate renewed manually at 08:55.', root_cause: 'Renewal was manual and depended on one person; no expiry alert.', responsible_id: id('sarra') }, LEAD);
  await s.improvement.addAction(project.id, ncOutage.id, { description: 'Automate certificate renewal with AWS Certificate Manager and alert 30 days before any expiry', responsible_id: id('sarra'), due_date: '2026-11-15' }, LEAD);
  ir = await s.improvement.createNonconformity(project.id, { title: 'Former contractor account still active in GitLab', description: 'A freelancer whose contract ended on 31 August 2026 could still log in to GitLab on 12 October.', detected_on: '2026-10-12', responsible_id: id('youssef') }, LEAD);
  const ncGit = ir.nonconformities.find(n => n.title.startsWith('Former contractor'));
  await s.improvement.updateNonconformity(project.id, ncGit.id, { correction: 'Account disabled on 12 October; its activity since 31 August reviewed (no access).', root_cause: 'Contractor accounts were not in the HR leaver process.' }, LEAD);
  await s.improvement.addAction(project.id, ncGit.id, { description: 'Add contractors to the leaver checklist and review GitLab and AWS accounts every month', responsible_id: id('youssef'), due_date: '2026-11-30' }, LEAD);
  log('✔ Registers: 2 incidents, 2 nonconformities with corrective actions');

  // Real mailboxes for testing the e-mails (existing accounts keep their password; new ones get the demo password).
  const TESTERS = [
    { email: 'amina.bayoudh@ieee.org', first: 'Amina', last: 'Bayoudh', org: 'ORG_ADMIN', project: 'PROJECT_MEMBER', iso: ['INFORMATION_SECURITY_MANAGER'] },
    { email: 'bibiko218@gmail.com', first: 'Test', last: 'Member', org: 'ORG_MEMBER', project: 'PROJECT_MEMBER', iso: ['TOP_MANAGEMENT'] },
    { email: 'aminabayoudh5@gmail.com', first: 'Amina', last: 'Bayoudh (Gmail)', org: 'ORG_MEMBER', project: 'PROJECT_AUDITOR', iso: ['INTERNAL_AUDITOR'] },
  ];
  for (const t of TESTERS) {
    const user = await prisma.user.findUnique({ where: { email: t.email } })
      ?? await prisma.user.create({ data: { email: t.email, first_name: t.first, last_name: t.last, password_hash, is_active: true, is_email_verified: true, timezone: 'Africa/Tunis' } });
    await prisma.organizationMember.create({ data: { organization_id: org.id, user_id: user.id, role: t.org } });
    const m = await prisma.projectMember.create({ data: { project_id: project.id, user_id: user.id, privilege: t.project } });
    await prisma.projectMemberIsoRole.createMany({ data: t.iso.map(r => ({ project_member_id: m.id, iso_role: r })) });
  }
  log(`✔ Testers added: ${TESTERS.map(t => t.email).join(', ')}`);

  const view = await s.projects.findOne(project.id, LEAD);
  console.log(`\nNovaTeck ready: ${view.progress.completed_steps}/${view.progress.total_steps} steps (${view.progress.percent}%), ${mails} e-mails not sent.`);
  console.log(`Log in at http://localhost:3000/login with ${mailOf('<name>')} (amina, karim, leila, youssef, sarra, nour, mehdi, ines, omar, rania), password ${PASSWORD}`);
  await app.close();
})().catch(e => { console.error('\nSEED FAILED:', e.message); process.exit(1); });
