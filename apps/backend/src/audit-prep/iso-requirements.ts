/**
 * Internal audit checklist for the ISO/IEC 27001:2022 management system
 * requirements (clauses 4 to 10), phrased as audit questions with the
 * evidence an auditor looks for. Annex A controls are added per audit from
 * the controls marked applicable in the Statement of Applicability.
 */
export const ISO_REQUIREMENTS: { ref: string; requirement: string; question: string }[] = [
  { ref: '4.1', requirement: 'Understanding the organization and its context', question: 'Have the external and internal issues relevant to the ISMS been determined, and are they kept up to date? (e.g. ISMS scope document, context analysis)' },
  { ref: '4.2', requirement: 'Needs and expectations of interested parties', question: 'Are the interested parties, their relevant requirements, and which of them are addressed through the ISMS determined? (e.g. register of requirements)' },
  { ref: '4.3', requirement: 'Scope of the ISMS', question: 'Is the ISMS scope documented, including boundaries, interfaces and dependencies with activities performed by other organizations?' },
  { ref: '4.4', requirement: 'Information security management system', question: 'Are the ISMS processes and their interactions established, implemented, maintained and continually improved?' },
  { ref: '5.1', requirement: 'Leadership and commitment', question: 'Does top management demonstrate leadership: policy and objectives aligned with strategy, resources available, importance of information security communicated?' },
  { ref: '5.2', requirement: 'Information security policy', question: 'Is the information security policy documented, approved, communicated within the organization and available to interested parties?' },
  { ref: '5.3', requirement: 'Roles, responsibilities and authorities', question: 'Are responsibilities and authorities for information security roles assigned and communicated, including reporting on ISMS performance to top management?' },
  { ref: '6.1.1', requirement: 'Actions to address risks and opportunities', question: 'Have the risks and opportunities that need to be addressed been determined, and are actions planned and evaluated for effectiveness?' },
  { ref: '6.1.2', requirement: 'Information security risk assessment', question: 'Is a risk assessment process defined (acceptance criteria, criteria for performing assessments) that produces consistent, valid and comparable results, with risk owners identified?' },
  { ref: '6.1.3', requirement: 'Information security risk treatment', question: 'Are treatment options selected, controls compared with Annex A, a Statement of Applicability produced with justifications, a risk treatment plan formulated, and residual risks accepted by risk owners?' },
  { ref: '6.2', requirement: 'Information security objectives and planning', question: 'Are measurable objectives established, monitored and communicated, with what will be done, resources, responsibilities, deadlines and how results are evaluated?' },
  { ref: '6.3', requirement: 'Planning of changes', question: 'When changes to the ISMS are needed, are they carried out in a planned manner?' },
  { ref: '7.1', requirement: 'Resources', question: 'Are the resources needed for the ISMS determined and provided?' },
  { ref: '7.2', requirement: 'Competence', question: 'Is the necessary competence determined and ensured through education, training or experience, the effectiveness of actions evaluated, and evidence retained?' },
  { ref: '7.3', requirement: 'Awareness', question: 'Are people aware of the information security policy, their contribution to the ISMS, and the implications of not conforming?' },
  { ref: '7.4', requirement: 'Communication', question: 'Is it determined what, when, with whom and how to communicate about the ISMS?' },
  { ref: '7.5', requirement: 'Documented information', question: 'Is the documented information required by the standard and the ISMS created, updated (identification, format, review, approval) and controlled (distribution, access, storage, retention)?' },
  { ref: '8.1', requirement: 'Operational planning and control', question: 'Are the processes needed to meet the requirements planned, implemented and controlled, including outsourced processes and planned changes?' },
  { ref: '8.2', requirement: 'Information security risk assessment (operation)', question: 'Are risk assessments performed at planned intervals and when significant changes occur, and are their results retained?' },
  { ref: '8.3', requirement: 'Information security risk treatment (operation)', question: 'Is the risk treatment plan implemented, and are the results of risk treatment retained?' },
  { ref: '9.1', requirement: 'Monitoring, measurement, analysis and evaluation', question: 'Is it determined what is monitored and measured, by which methods, when, by whom, and are the results analysed, evaluated and retained?' },
  { ref: '9.2', requirement: 'Internal audit', question: 'Is an audit programme (frequency, methods, responsibilities, reporting) established, and are audits conducted by objective and impartial auditors, with results reported to management?' },
  { ref: '9.3', requirement: 'Management review', question: 'Does top management review the ISMS at planned intervals, considering all the required inputs, and are the decisions retained?' },
  { ref: '10.1', requirement: 'Continual improvement', question: 'Is the suitability, adequacy and effectiveness of the ISMS continually improved?' },
  { ref: '10.2', requirement: 'Nonconformity and corrective action', question: 'Are nonconformities reacted to, their causes analysed, corrective actions implemented and their effectiveness reviewed, with evidence retained?' },
];

export const DEFAULT_AUDIT_CRITERIA =
  'ISO/IEC 27001:2022 requirements (clauses 4 to 10), the controls declared applicable in the Statement of Applicability, and the ISMS policies and procedures of the organization.';

export const DEFAULT_AUDIT_SCOPE = 'The entire Information Security Management System (ISMS) as defined in the ISMS scope document.';
