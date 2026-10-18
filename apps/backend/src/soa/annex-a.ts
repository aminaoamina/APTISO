/**
 * ISO/IEC 27001:2022 Annex A catalogue used by the Statement of Applicability.
 *
 * For each of the 93 controls:
 *  - method:    suggested implementation method (editable by the user),
 *  - documents: the policy/procedure documents that implement the control.
 *               Phase 3 uses these to decide which documents become steps
 *               (Conformio: "the necessary policy and procedure documents ...
 *               will be automatically added as steps").
 *
 * Control titles come from the risk_controls table (seeded by migration).
 */

// Documents (Conformio's 21 Phase 3 candidates, plus its IT Security Policy
// step and the documents APTISO already produces in Phase 1).
export const DOC = {
  ACCESS_CONTROL: 'Access control policy',
  BACKUP: 'Backup policy',
  BYOD: 'Bring your own device policy',
  CHANGE_MANAGEMENT: 'Change management policy',
  CLEAR_DESK: 'Clear desk and clear screen policy',
  CONFIDENTIALITY: 'Confidentiality statement',
  DISASTER_RECOVERY: 'Disaster recovery plan',
  DISPOSAL: 'Disposal and destruction policy',
  CLASSIFICATION: 'Information classification policy',
  INFORMATION_TRANSFER: 'Information transfer policy',
  MOBILE_TELEWORK: 'Mobile Device, Teleworking and Work From Home Policy',
  PASSWORD: 'Password policy',
  ENCRYPTION: 'Policy on the use of encryption',
  SECURE_AREAS: 'Procedures for working in secure areas',
  SECURE_DEVELOPMENT: 'Secure development policy',
  SUPPLIER_CLAUSES: 'Security clauses for suppliers and partners',
  IT_PROCEDURES: 'Security procedures for IT department',
  SYSTEM_REQUIREMENTS: 'Specification of information system requirements',
  SUPPLIER_SECURITY: 'Supplier security policy',
  INCIDENT_MANAGEMENT: 'Incident management procedure',
  IT_SECURITY_POLICY: 'IT Security Policy',
  // Phase 1 documents
  SECURITY_POLICY: 'Information Security Policy',
  DOCUMENT_CONTROL: 'Procedure for Document and Record Control',
  LEGAL_REGISTER: 'Register of Legal, Contractual, and Other Requirements',
} as const;

type Doc = (typeof DOC)[keyof typeof DOC];

export interface AnnexAEntry {
  method: string;
  documents: Doc[];
}

const d = DOC;

export const ANNEX_A: Record<string, AnnexAEntry> = {
  // ─── A.5 Organizational controls ───
  'A.5.1': { method: 'The Information Security Policy and topic-specific policies are approved by top management, communicated to employees and relevant parties, and reviewed at planned intervals.', documents: [d.SECURITY_POLICY] },
  'A.5.2': { method: 'Information security roles and responsibilities are defined in the Information Security Policy and in job descriptions.', documents: [d.SECURITY_POLICY] },
  'A.5.3': { method: 'Conflicting duties and areas of responsibility are identified and segregated; rules are defined in the Access control policy.', documents: [d.ACCESS_CONTROL] },
  'A.5.4': { method: 'Management requires all personnel to apply information security in accordance with the established policies, as defined in the Information Security Policy.', documents: [d.SECURITY_POLICY] },
  'A.5.5': { method: 'Contacts with relevant authorities (police, regulators, data protection authority) are listed and used as defined in the Incident management procedure and the Disaster recovery plan.', documents: [d.INCIDENT_MANAGEMENT, d.DISASTER_RECOVERY] },
  'A.5.6': { method: 'The security manager maintains contacts with special interest groups, professional associations and security forums.', documents: [] },
  'A.5.7': { method: 'Information about threats is collected from vendors, CERTs and security feeds, analysed, and relevant threats are reported and acted on.', documents: [d.IT_PROCEDURES] },
  'A.5.8': { method: 'Information security requirements are identified and addressed in every project, as defined in the Specification of information system requirements.', documents: [d.SYSTEM_REQUIREMENTS] },
  'A.5.9': { method: 'Information and other associated assets are listed with their owners in the asset inventory, which is kept up to date; rules are in the IT Security Policy.', documents: [d.IT_SECURITY_POLICY] },
  'A.5.10': { method: 'Rules for the acceptable use of information and assets are defined in the IT Security Policy and communicated to all users.', documents: [d.IT_SECURITY_POLICY] },
  'A.5.11': { method: 'Employees and external users return all organizational assets on termination of employment or contract, as defined in the IT Security Policy.', documents: [d.IT_SECURITY_POLICY] },
  'A.5.12': { method: 'Information is classified according to confidentiality, integrity, availability and legal requirements, as defined in the Information classification policy.', documents: [d.CLASSIFICATION] },
  'A.5.13': { method: 'Information is labelled according to the classification scheme defined in the Information classification policy.', documents: [d.CLASSIFICATION] },
  'A.5.14': { method: 'Rules and agreements for transferring information internally and with external parties are defined in the Information transfer policy.', documents: [d.INFORMATION_TRANSFER, d.IT_SECURITY_POLICY] },
  'A.5.15': { method: 'Rules for physical and logical access to information and assets are defined in the Access control policy, based on business and security requirements.', documents: [d.ACCESS_CONTROL] },
  'A.5.16': { method: 'The full life cycle of identities (creation, change, removal) is managed as defined in the Access control policy.', documents: [d.ACCESS_CONTROL] },
  'A.5.17': { method: 'Allocation and management of authentication information (passwords, tokens) and user responsibilities are defined in the Password policy and the IT Security Policy.', documents: [d.PASSWORD, d.IT_SECURITY_POLICY] },
  'A.5.18': { method: 'Access rights are provisioned, reviewed at regular intervals and removed as defined in the Access control policy.', documents: [d.ACCESS_CONTROL] },
  'A.5.19': { method: 'Information security risks related to suppliers are identified and managed as defined in the Supplier security policy.', documents: [d.SUPPLIER_SECURITY] },
  'A.5.20': { method: 'Information security requirements are included in supplier agreements using the Security clauses for suppliers and partners.', documents: [d.SUPPLIER_CLAUSES] },
  'A.5.21': { method: 'Security risks in the ICT products and services supply chain are addressed as defined in the Supplier security policy.', documents: [d.SUPPLIER_SECURITY] },
  'A.5.22': { method: 'Supplier services are monitored and reviewed regularly, and changes are managed, as defined in the Supplier security policy.', documents: [d.SUPPLIER_SECURITY] },
  'A.5.23': { method: 'Acquisition, use, management and exit from cloud services follow the security requirements defined in the Supplier security policy.', documents: [d.SUPPLIER_SECURITY] },
  'A.5.24': { method: 'Incident management responsibilities, processes and communication are planned and defined in the Incident management procedure.', documents: [d.INCIDENT_MANAGEMENT] },
  'A.5.25': { method: 'Information security events are assessed and classified as incidents or not, as defined in the Incident management procedure.', documents: [d.INCIDENT_MANAGEMENT] },
  'A.5.26': { method: 'Information security incidents are responded to according to the Incident management procedure.', documents: [d.INCIDENT_MANAGEMENT] },
  'A.5.27': { method: 'Knowledge gained from incidents is used to strengthen controls; lessons learned are recorded as defined in the Incident management procedure.', documents: [d.INCIDENT_MANAGEMENT] },
  'A.5.28': { method: 'Evidence related to incidents is identified, collected and preserved as defined in the Incident management procedure.', documents: [d.INCIDENT_MANAGEMENT] },
  'A.5.29': { method: 'Information security is maintained at an appropriate level during disruption, as defined in the Disaster recovery plan.', documents: [d.DISASTER_RECOVERY] },
  'A.5.30': { method: 'ICT readiness is planned, implemented and tested based on business continuity objectives, as defined in the Disaster recovery plan.', documents: [d.DISASTER_RECOVERY] },
  'A.5.31': { method: 'Legal, statutory, regulatory and contractual requirements are identified and kept up to date in the Register of Legal, Contractual, and Other Requirements.', documents: [d.LEGAL_REGISTER] },
  'A.5.32': { method: 'Intellectual property rights and the use of licensed software are protected as defined in the IT Security Policy.', documents: [d.IT_SECURITY_POLICY] },
  'A.5.33': { method: 'Records are protected from loss, destruction, falsification and unauthorized access as defined in the Procedure for Document and Record Control.', documents: [d.DOCUMENT_CONTROL] },
  'A.5.34': { method: 'Privacy and protection of personal data (PII) comply with applicable laws and regulations listed in the Register of Legal, Contractual, and Other Requirements.', documents: [d.LEGAL_REGISTER] },
  'A.5.35': { method: 'The approach to information security is reviewed independently at planned intervals and after significant changes (internal audits).', documents: [] },
  'A.5.36': { method: 'Managers regularly review compliance with the information security policies, rules and standards in their areas; results are reported to management review.', documents: [] },
  'A.5.37': { method: 'Operating procedures for information processing facilities are documented and made available to the personnel who need them.', documents: [d.IT_PROCEDURES] },

  // ─── A.6 People controls ───
  'A.6.1': { method: 'Background verification checks are carried out on candidates before joining, in line with laws, regulations and the classification of information they will access.', documents: [] },
  'A.6.2': { method: 'Employment contracts state the personnel\'s and the organization\'s responsibilities for information security.', documents: [d.CONFIDENTIALITY] },
  'A.6.3': { method: 'Personnel receive information security awareness, education and training, and regular updates of policies relevant to their job (training and awareness plan).', documents: [] },
  'A.6.4': { method: 'A formal disciplinary process for violations of the information security policy is defined and communicated.', documents: [d.SECURITY_POLICY] },
  'A.6.5': { method: 'Information security responsibilities that remain valid after termination or change of employment are defined in contracts and the Confidentiality statement.', documents: [d.CONFIDENTIALITY] },
  'A.6.6': { method: 'Confidentiality or non-disclosure agreements are signed by personnel and external parties, using the Confidentiality statement.', documents: [d.CONFIDENTIALITY] },
  'A.6.7': { method: 'Security measures for remote working are defined in the Mobile Device, Teleworking and Work From Home Policy.', documents: [d.MOBILE_TELEWORK, d.IT_SECURITY_POLICY] },
  'A.6.8': { method: 'Personnel report observed or suspected information security events through the channels defined in the Incident management procedure.', documents: [d.INCIDENT_MANAGEMENT] },

  // ─── A.7 Physical controls ───
  'A.7.1': { method: 'Security perimeters are defined and used to protect areas containing information and assets, as defined in the Procedures for working in secure areas.', documents: [d.SECURE_AREAS] },
  'A.7.2': { method: 'Secure areas are protected by entry controls and access points, as defined in the Procedures for working in secure areas.', documents: [d.SECURE_AREAS] },
  'A.7.3': { method: 'Physical security for offices, rooms and facilities is designed and implemented as defined in the Procedures for working in secure areas.', documents: [d.SECURE_AREAS] },
  'A.7.4': { method: 'Premises are continuously monitored for unauthorized physical access (alarms, CCTV), as defined in the Procedures for working in secure areas.', documents: [d.SECURE_AREAS] },
  'A.7.5': { method: 'Protection against physical and environmental threats (fire, flood, natural disasters) is designed and implemented for the premises.', documents: [d.SECURE_AREAS] },
  'A.7.6': { method: 'Security measures for working in secure areas are defined in the Procedures for working in secure areas.', documents: [d.SECURE_AREAS] },
  'A.7.7': { method: 'Clear desk rules for papers and removable media and clear screen rules for information processing facilities are defined in the Clear desk and clear screen policy.', documents: [d.CLEAR_DESK, d.IT_SECURITY_POLICY] },
  'A.7.8': { method: 'Equipment is sited securely and protected, as defined in the Security procedures for IT department.', documents: [d.IT_PROCEDURES] },
  'A.7.9': { method: 'Assets used off-site are protected as defined in the Mobile Device, Teleworking and Work From Home Policy.', documents: [d.MOBILE_TELEWORK, d.IT_SECURITY_POLICY] },
  'A.7.10': { method: 'Storage media are managed through their life cycle of acquisition, use, transport and disposal as defined in the IT Security Policy.', documents: [d.IT_SECURITY_POLICY] },
  'A.7.11': { method: 'Information processing facilities are protected from power failures and other disruptions caused by failures in supporting utilities (UPS, generators).', documents: [d.IT_PROCEDURES] },
  'A.7.12': { method: 'Power, data and telecommunication cables are protected from interception, interference and damage, as defined in the Security procedures for IT department.', documents: [d.IT_PROCEDURES] },
  'A.7.13': { method: 'Equipment is maintained correctly to ensure availability, integrity and confidentiality, as defined in the Security procedures for IT department.', documents: [d.IT_PROCEDURES] },
  'A.7.14': { method: 'Equipment containing storage media is verified so that sensitive data and licensed software are removed or securely overwritten before disposal or re-use, as defined in the Disposal and destruction policy.', documents: [d.DISPOSAL] },

  // ─── A.8 Technological controls ───
  'A.8.1': { method: 'Information stored on, processed by or accessible via user endpoint devices is protected as defined in the IT Security Policy (and the Bring your own device policy where personal devices are allowed).', documents: [d.IT_SECURITY_POLICY, d.BYOD] },
  'A.8.2': { method: 'Allocation and use of privileged access rights is restricted and managed as defined in the Access control policy.', documents: [d.ACCESS_CONTROL] },
  'A.8.3': { method: 'Access to information and application functions is restricted according to the Access control policy.', documents: [d.ACCESS_CONTROL] },
  'A.8.4': { method: 'Read and write access to source code, development tools and software libraries is managed as defined in the Secure development policy.', documents: [d.SECURE_DEVELOPMENT] },
  'A.8.5': { method: 'Secure authentication technologies and procedures (e.g. multi-factor authentication) are implemented based on access restrictions and the Access control policy.', documents: [d.ACCESS_CONTROL, d.PASSWORD] },
  'A.8.6': { method: 'The use of resources is monitored and adjusted in line with current and expected capacity requirements, as defined in the Security procedures for IT department.', documents: [d.IT_PROCEDURES] },
  'A.8.7': { method: 'Protection against malware is implemented (anti-malware software, user awareness) as defined in the IT Security Policy.', documents: [d.IT_SECURITY_POLICY] },
  'A.8.8': { method: 'Information about technical vulnerabilities is obtained, exposure is evaluated and appropriate measures (patching) are taken, as defined in the Security procedures for IT department.', documents: [d.IT_PROCEDURES] },
  'A.8.9': { method: 'Configurations, including security configurations, of hardware, software, services and networks are established, documented, monitored and reviewed.', documents: [d.IT_PROCEDURES] },
  'A.8.10': { method: 'Information stored in systems, devices and storage media is deleted when no longer required, as defined in the Disposal and destruction policy.', documents: [d.DISPOSAL] },
  'A.8.11': { method: 'Data masking is used in line with the Information classification policy and legal requirements, particularly for personal data used outside production.', documents: [d.CLASSIFICATION] },
  'A.8.12': { method: 'Data leakage prevention measures are applied to systems, networks and devices that process sensitive information, based on the Information classification policy.', documents: [d.CLASSIFICATION] },
  'A.8.13': { method: 'Backup copies of information, software and systems are maintained and regularly tested as defined in the Backup policy.', documents: [d.BACKUP, d.IT_SECURITY_POLICY] },
  'A.8.14': { method: 'Information processing facilities are implemented with sufficient redundancy to meet availability requirements, as defined in the Disaster recovery plan.', documents: [d.DISASTER_RECOVERY] },
  'A.8.15': { method: 'Logs that record activities, exceptions, faults and other relevant events are produced, stored, protected and analysed, as defined in the Security procedures for IT department.', documents: [d.IT_PROCEDURES] },
  'A.8.16': { method: 'Networks, systems and applications are monitored for anomalous behaviour, and potential incidents are evaluated.', documents: [d.IT_PROCEDURES] },
  'A.8.17': { method: 'Clocks of information processing systems are synchronized to approved time sources.', documents: [d.IT_PROCEDURES] },
  'A.8.18': { method: 'The use of utility programs capable of overriding system and application controls is restricted and tightly controlled.', documents: [d.IT_PROCEDURES] },
  'A.8.19': { method: 'Installation of software on operational systems is controlled as defined in the IT Security Policy.', documents: [d.IT_SECURITY_POLICY] },
  'A.8.20': { method: 'Networks and network devices are secured, managed and controlled to protect information in systems and applications.', documents: [d.IT_PROCEDURES] },
  'A.8.21': { method: 'Security mechanisms, service levels and requirements of network services are identified, implemented and monitored.', documents: [d.IT_PROCEDURES] },
  'A.8.22': { method: 'Groups of information services, users and information systems are segregated in the networks.', documents: [d.IT_PROCEDURES] },
  'A.8.23': { method: 'Access to external websites is managed to reduce exposure to malicious content, as defined in the IT Security Policy.', documents: [d.IT_SECURITY_POLICY] },
  'A.8.24': { method: 'Rules for the effective use of cryptography, including key management, are defined in the Policy on the use of encryption.', documents: [d.ENCRYPTION] },
  'A.8.25': { method: 'Rules for the secure development of software and systems are established and applied, as defined in the Secure development policy.', documents: [d.SECURE_DEVELOPMENT] },
  'A.8.26': { method: 'Information security requirements are identified, specified and approved when developing or acquiring applications, as defined in the Specification of information system requirements.', documents: [d.SYSTEM_REQUIREMENTS] },
  'A.8.27': { method: 'Principles for engineering secure systems are established, documented, maintained and applied, as defined in the Secure development policy.', documents: [d.SECURE_DEVELOPMENT] },
  'A.8.28': { method: 'Secure coding principles are applied to software development, as defined in the Secure development policy.', documents: [d.SECURE_DEVELOPMENT] },
  'A.8.29': { method: 'Security testing processes are defined and implemented in the development life cycle, as defined in the Secure development policy.', documents: [d.SECURE_DEVELOPMENT] },
  'A.8.30': { method: 'Outsourced system development is directed, monitored and reviewed, as defined in the Secure development policy and supplier agreements.', documents: [d.SECURE_DEVELOPMENT, d.SUPPLIER_CLAUSES] },
  'A.8.31': { method: 'Development, testing and production environments are separated and secured, as defined in the Secure development policy.', documents: [d.SECURE_DEVELOPMENT] },
  'A.8.32': { method: 'Changes to information processing facilities and information systems are subject to the Change management policy.', documents: [d.CHANGE_MANAGEMENT] },
  'A.8.33': { method: 'Test information is appropriately selected, protected and managed, as defined in the Secure development policy.', documents: [d.SECURE_DEVELOPMENT] },
  'A.8.34': { method: 'Audit tests and other assurance activities involving assessment of operational systems are planned and agreed between the tester and appropriate management.', documents: [d.IT_PROCEDURES] },
};

// ─── SoA setup questionnaire ─────────────────────────────────────

export interface SetupQuestion {
  key: string;
  question: string;
  help: string;
  /** Controls suggested as not applicable when the answer is "No". */
  excludesWhenNo: string[];
  /** Justification written for those controls. */
  exclusionJustification: string;
}

export const SOA_SETUP_QUESTIONS: SetupQuestion[] = [
  {
    key: 'develops_software',
    question: 'Does your organization develop software in-house?',
    help: 'Including websites, apps, scripts or integrations written by your own staff.',
    excludesWhenNo: ['A.8.4', 'A.8.25', 'A.8.27', 'A.8.28', 'A.8.29', 'A.8.31', 'A.8.33'],
    exclusionJustification: 'Not applicable: the organization does not develop software in-house (SoA setup).',
  },
  {
    key: 'outsources_development',
    question: 'Do you outsource software development to external parties?',
    help: 'For example a software agency or freelance developers building systems for you.',
    excludesWhenNo: ['A.8.30'],
    exclusionJustification: 'Not applicable: the organization does not outsource system development (SoA setup).',
  },
  {
    key: 'uses_cloud',
    question: 'Do you use cloud services?',
    help: 'For example Microsoft 365, Google Workspace, AWS, Azure, Dropbox, SaaS applications.',
    excludesWhenNo: ['A.5.23'],
    exclusionJustification: 'Not applicable: the organization does not use cloud services (SoA setup).',
  },
  {
    key: 'has_premises',
    question: 'Does your organization have its own offices or facilities within the ISMS scope?',
    help: 'Answer "No" if everybody works remotely and the organization has no premises to protect.',
    excludesWhenNo: ['A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.7.6'],
    exclusionJustification: 'Not applicable: the organization has no premises within the ISMS scope; all work is performed remotely (SoA setup).',
  },
  {
    key: 'remote_work',
    question: 'Do employees work remotely or from home?',
    help: 'Even occasionally, e.g. from home or while travelling.',
    excludesWhenNo: ['A.6.7'],
    exclusionJustification: 'Not applicable: remote working is not allowed in the organization (SoA setup).',
  },
  {
    key: 'devices_offsite',
    question: 'Are laptops, phones or other assets used outside your premises?',
    help: 'For example laptops taken home or to customer sites.',
    excludesWhenNo: ['A.7.9'],
    exclusionJustification: 'Not applicable: organizational assets are not used outside the premises (SoA setup).',
  },
  {
    key: 'personal_devices',
    question: 'Do employees use personal devices (BYOD) for work?',
    help: 'Personal phones or computers used to access company email or data. Used to decide whether a BYOD policy is needed.',
    excludesWhenNo: [],
    exclusionJustification: '',
  },
  {
    key: 'processes_personal_data',
    question: 'Does your organization process personal data (of employees, customers or others)?',
    help: 'Almost every organization does, e.g. employee records or customer contacts.',
    excludesWhenNo: ['A.5.34'],
    exclusionJustification: 'Not applicable: the organization does not process personal data within the ISMS scope (SoA setup).',
  },
];

export const BASELINE_JUSTIFICATION =
  'Applicable: required to protect the information within the ISMS scope; no reason for exclusion was identified.';

/** Checks the catalogue covers exactly the 93 controls; called at startup. */
export function assertAnnexACatalog(controlCodes: string[]) {
  const missing = controlCodes.filter(c => !ANNEX_A[c]);
  const extra = Object.keys(ANNEX_A).filter(c => !controlCodes.includes(c));
  const badExclusions = SOA_SETUP_QUESTIONS.flatMap(q => q.excludesWhenNo).filter(c => !ANNEX_A[c]);
  if (Object.keys(ANNEX_A).length !== 93 || missing.length || extra.length || badExclusions.length) {
    throw new Error(
      `Annex A catalogue is inconsistent: ${Object.keys(ANNEX_A).length} entries; missing ${missing.join(', ') || '-'}; ` +
        `unknown ${extra.join(', ') || '-'}; bad exclusions ${badExclusions.join(', ') || '-'}`,
    );
  }
}
