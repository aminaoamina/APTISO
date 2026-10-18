/**
 * Phase 4 procedures created as ready-to-adapt drafts (no question wizard):
 * the procedure for nonconformities and corrective actions (clauses 10.1,
 * 10.2) and the internal audit procedure (clause 9.2). `{org}` is replaced
 * by the organization name. Both describe how APTISO's registers are used.
 */
export interface ProcedureSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface ProcedureDefinition {
  key: string;
  stepKey: string;
  title: string;
  purpose: string;
  references: string[];
  sections: ProcedureSection[];
}

export const PROCEDURE_CATALOG: ProcedureDefinition[] = [
  {
    key: 'nonconformity-procedure',
    stepKey: 'iso27001.p4s1.nonconformity-procedure',
    title: 'Procedure for Nonconformities and Corrective Actions',
    purpose: 'describe all activities related to nonconformities, corrections and corrective actions, and the use of the Nonconformity and Corrective Action registers',
    references: ['ISO/IEC 27001 standard, clauses 10.1 and 10.2', 'Information Security Policy', 'Incident management procedure', 'Internal Audit Procedure'],
    sections: [
      {
        heading: 'Definitions',
        bullets: [
          'Nonconformity: non-fulfilment of a requirement — of the ISO/IEC 27001 standard, of a policy or procedure of the ISMS, of a contract, law or regulation.',
          'Correction: action taken to eliminate a detected nonconformity (to fix the immediate problem).',
          'Corrective action: action taken to eliminate the cause of a nonconformity and to prevent it from happening again.',
        ],
      },
      {
        heading: 'Identifying and recording nonconformities',
        paragraphs: [
          'Any employee, supplier or partner of {org} who notices that a requirement is not fulfilled reports it to the person responsible for the ISMS. Nonconformities are also identified through internal and external audits, incidents, management reviews and monitoring of security objectives.',
          'Every nonconformity is recorded in the Nonconformity register with its description, source, date of detection and the person who reported it. Nonconformities found during an internal audit are recorded automatically from the audit checklist.',
        ],
      },
      {
        heading: 'Correction and root cause analysis',
        paragraphs: [
          'The person responsible for the ISMS assigns a responsible person for each nonconformity. The responsible person decides and records the correction — the immediate action to control and correct the nonconformity and deal with its consequences.',
          'The responsible person then analyses the root cause of the nonconformity, and determines whether similar nonconformities exist or could potentially occur. The root cause is recorded in the Nonconformity register.',
        ],
      },
      {
        heading: 'Corrective actions',
        paragraphs: [
          'Based on the root cause, the responsible person defines one or more corrective actions, each with a responsible person and a deadline, in the Nonconformity register. Corrective actions must be appropriate to the effects of the nonconformity encountered.',
          'Each corrective action creates a task for its responsible person. When the action is completed, the responsible person marks it as done.',
        ],
      },
      {
        heading: 'Review of effectiveness and closing',
        paragraphs: [
          'When all corrective actions are done, the person responsible for the ISMS reviews their effectiveness — whether the cause was eliminated and the nonconformity did not recur — and records the result. Only then is the nonconformity resolved.',
          'If the review shows that a report was not a real nonconformity, it is closed as "not relevant" with a justification. If the corrective actions were not effective, the nonconformity is reopened and new actions are defined. Where necessary, changes are made to the ISMS.',
        ],
      },
      {
        heading: 'Managing records',
        paragraphs: [
          'The Nonconformity register, including corrections, root causes, corrective actions and effectiveness reviews, is kept in APTISO as evidence of the nature of the nonconformities and of the results of the corrective actions (clause 10.2). Records are kept for at least three years. The status of nonconformities and corrective actions is presented at every management review.',
        ],
      },
    ],
  },
  {
    key: 'internal-audit-procedure',
    stepKey: 'iso27001.p4s2.internal-audit-procedure',
    title: 'Internal Audit Procedure',
    purpose: 'describe all audit-related activities — writing the audit programme, selecting an auditor, conducting individual audits and reporting — and the use of the internal audit module',
    references: ['ISO/IEC 27001 standard, clause 9.2', 'ISO 19011, Guidelines for auditing management systems', 'Procedure for Nonconformities and Corrective Actions'],
    sections: [
      {
        heading: 'Audit programme',
        paragraphs: [
          'Internal audits verify whether the ISMS of {org} conforms to its own requirements and to ISO/IEC 27001, and whether it is effectively implemented and maintained. The whole ISMS scope, all clauses of the standard and all applicable controls of the Statement of Applicability are audited at least once a year, and more often for areas with high risks or with nonconformities found in previous audits.',
          'The person responsible for the ISMS prepares the annual audit programme — the audits, their scope, criteria, dates and auditors — and schedules them in the internal audit module.',
        ],
      },
      {
        heading: 'Selection of auditors',
        paragraphs: [
          'Internal audits are performed by competent persons who are objective and impartial: auditors do not audit their own work. When there is no suitable internal person, an external auditor is engaged.',
        ],
      },
      {
        heading: 'Conducting the audit',
        paragraphs: [
          'The lead auditor informs the auditees of the audit date and scope. The audit is performed with the checklist, which lists the requirements of ISO/IEC 27001 and the applicable controls. For each item the auditor collects evidence — documents and records reviewed, interviews, observations — and records the result: conforming, minor nonconformity, major nonconformity, observation, or not audited.',
          'Every nonconformity found is recorded in the Nonconformity register, where it is handled according to the Procedure for Nonconformities and Corrective Actions.',
        ],
      },
      {
        heading: 'Reporting',
        paragraphs: [
          'At the end of the audit the lead auditor writes the conclusion and reports the audit. Top management reviews and approves the Internal Audit Report. The results of internal audits are presented at the management review.',
        ],
      },
      {
        heading: 'Managing records',
        paragraphs: [
          'The audit programme, checklists with the evidence collected, and the approved audit reports are kept in APTISO as evidence of the implementation of the audit programme and of the audit results (clause 9.2). Records are kept for at least three years.',
        ],
      },
    ],
  },
];

export const findProcedureByStepKey = (stepKey: string) => PROCEDURE_CATALOG.find(p => p.stepKey === stepKey);

export const PROCEDURE_WHY = 'This document is not mandatory, so if you do not see a benefit in using it, you can skip it.';
