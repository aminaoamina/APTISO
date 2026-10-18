/**
 * Risk Assessment and Risk Treatment Methodology — Phase 2 Step 1.
 * (ISO/IEC 27001 clauses 6.1, 8.2, and 8.3).
 *
 * Wizard questions live in the database (template_questions seeded by migration).
 * This file maps wizard answers to a structured Tiptap/ProseMirror document.
 */

export const RISK_METHODOLOGY_TEMPLATE_CODE = 'RISK-METHODOLOGY';

import {
  ProseMirrorNode,
  WizardAnswers,
  text,
  italic,
  placeholder,
  fill,
  paragraph,
  heading,
  bulletList,
  table,
  splitLines,
} from './doc-control.template';

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------

export function generateRiskMethodologyContent(
  answers: WizardAnswers,
  ctx: { organizationName: string },
): ProseMirrorNode {
  const company = answers.company_name?.trim() || ctx.organizationName;
  const refDocLines = splitLines(answers.reference_documents);

  return {
    type: 'doc',
    content: [

    // ── 1. Purpose, scope and users ──
    heading(1, '1. Purpose, scope and users'),
    paragraph(
      text('The purpose of this document is to define the methodology for assessment and treatment of information risks in '),
      text(company),
      text(', and to define the acceptable level of risk.'),
    ),
    paragraph(
      text('Risk assessment and risk treatment are applied to the entire scope of the Information Security Management System (ISMS), i.e., to all assets which are used within the company, or which could have an impact on information security within the ISMS.'),
    ),
    paragraph(
      text('Users of this document are all employees who take part in risk assessment and risk treatment.'),
    ),

    // ── 2. Reference documents ──
    heading(1, '2. Reference documents'),
    bulletList([
      [text('ISO/IEC 27001 standard, clauses 6.1.2, 6.1.3, 8.2, and 8.3')],
      [text('Information Security Policy')],
      [text('List of Legal, Regulatory, Contractual and Other Requirements')],
      [text('Supplier Security Policy')],
      [text('Statement of Applicability')],
      ...refDocLines.length
        ? refDocLines.map((line: string) => [text(line)])
        : [[italic(placeholder('other relevant documents'))]],
    ]),

    // ── 3. Risk assessment and risk treatment methodology ──
    heading(1, '3. Risk assessment and risk treatment methodology'),

    // ── 3.1. Risk assessment ──
    heading(2, '3.1. Risk assessment'),

    heading(3, '3.1.1. The process'),
    paragraph(
      text('Risk assessment is implemented through the Risk Assessment Table. The risk assessment process is coordinated by '),
      fill(answers, 'risk_management_coordinator', 'risk management coordinator'),
      text(', identification of threats and vulnerabilities is performed by asset owners, and assessment of consequences and likelihood is performed by risk owners.'),
    ),

    heading(3, '3.1.2. Assets, vulnerabilities and threats'),
    paragraph(
      text('The first step in risk assessment is the identification of all assets in the ISMS scope by the representatives of each area in the ISMS scope — i.e., identify all assets that may affect the confidentiality, integrity, and availability of information in the company. Assets may include documents in paper or electronic form, applications and databases, people, IT equipment, infrastructure, cloud services, and external services/outsourced processes. When identifying assets, it is also necessary to identify their owners — the person or organizational unit responsible for each asset.'),
    ),
    paragraph(
      text('The next step is for the asset owners to identify all threats and vulnerabilities associated with each asset. Threats and vulnerabilities are identified using the catalogues included in the Risk Assessment Table. Every asset may be associated with several threats, and every threat may be associated with several vulnerabilities.'),
    ),

    heading(3, '3.1.3. Determining the risk owners'),
    paragraph(
      text('For each risk, a risk owner has to be identified — the person or organizational unit responsible for each risk. This person may or may not be the same as the asset owner.'),
    ),

    heading(3, '3.1.4. Consequences and likelihood'),
    paragraph(
      text('Once risk owners have been identified, it is necessary to assess consequences for each combination of threats and vulnerabilities for an individual asset if such a risk materializes:'),
    ),
    table([
      [
        [text('Level')],
        [text('Value')],
        [text('Description')],
      ],
      [
        [text('Low consequence')],
        [text('0')],
        [text('Loss of confidentiality, availability or integrity does not affect the company\'s cash flow, legal or contractual obligations, or its reputation.')],
      ],
      [
        [text('Moderate consequence')],
        [text('1')],
        [text('Loss of confidentiality, availability or integrity incurs costs and has a low or moderate impact on legal or contractual obligations, or the company\'s reputation.')],
      ],
      [
        [text('High consequence')],
        [text('2')],
        [text('Loss of confidentiality, availability or integrity has considerable and/or immediate impact on the company\'s cash flow, operations, legal or contractual obligations, or its reputation.')],
      ],
    ]),

    paragraph(
      text('After the assessment of consequences, it is necessary to assess the likelihood of occurrence of such a risk, i.e., the probability that a threat will exploit the vulnerability of the respective asset:'),
    ),
    table([
      [
        [text('Level')],
        [text('Value')],
        [text('Description')],
      ],
      [
        [text('Low likelihood')],
        [text('0')],
        [text('Existing security controls are strong and have so far provided an adequate level of protection. No new incidents are expected in the future.')],
      ],
      [
        [text('Moderate likelihood')],
        [text('1')],
        [text('Existing security controls are moderate and have mostly provided an adequate level of protection. New incidents are possible, but not highly likely.')],
      ],
      [
        [text('High likelihood')],
        [text('2')],
        [text('Existing security controls are low or ineffective. Such incidents have a high likelihood of occurring in the future.')],
      ],
    ]),

    paragraph(
      text('By entering the values of consequence and likelihood into the Risk Assessment Table, the level of risk is calculated automatically by adding up the two values. Existing security controls are to be entered in the last column of the Risk Assessment Table.'),
    ),

    // ── 3.2. Risk acceptance criteria ──
    heading(2, '3.2. Risk acceptance criteria'),
    paragraph(
      text('Risks with levels 0, 1, and 2 are acceptable risks, while risks with levels 3 and 4 are unacceptable risks. Unacceptable risks must be treated.'),
    ),

    // ── 3.3. Risk treatment ──
    heading(2, '3.3. Risk treatment'),
    paragraph(
      text('Risk treatment is implemented through the Risk Treatment Table, by copying all risks identified as unacceptable from the Risk Assessment Table. Risk treatment is conducted by the same person that coordinates the risk assessment and treatment process.'),
    ),
    paragraph(
      text('One or more treatment options must be selected for risks with risk level 3 and 4:'),
    ),
    bulletList([
      [text('Selection of security control or controls from ISO 27001 Annex A.')],
      [text('Transferring the risks to a third party — e.g., by purchasing an insurance policy or signing a contract with suppliers or partners.')],
      [text('Avoiding the risk by discontinuing a business activity that causes such risk.')],
      [text('Accepting the risk — this option is allowed only if the selection of other risk treatment options would cost more than the potential impact should such risk materialize.')],
    ]),
    paragraph(
      text('The selection of options is implemented through the Risk Treatment Table. Usually, option 1 is selected: selection of one or more security controls. When several security controls are selected for a risk, then additional rows are inserted into the table immediately below the row specifying the risk.'),
    ),
    paragraph(
      text('The treatment of risks related to outsourced processes must be addressed through the contracts with responsible third parties, as specified in Supplier Security Policy.'),
    ),
    paragraph(
      text('In the case when option 1 (selection of security controls) is used for risk treatment, it is necessary to assess the new value of consequence and likelihood (i.e., the residual risk) in the Risk Treatment Table, in order to evaluate the effectiveness of planned controls.'),
    ),

    // ── 3.4. Regular reviews ──
    heading(2, '3.4. Regular reviews of risk assessment and risk treatment'),
    paragraph(
      text('Risk owners must review existing risks and update the Risk Assessment Table and Risk Treatment Table in line with newly identified risks. The review is conducted at least once a year, or more frequently in the case of significant organizational changes, significant change in technology, change of business objectives, changes in the business environment, etc.'),
    ),

    // ── 3.5. Statement of applicability and risk treatment plan ──
    heading(2, '3.5. Statement of applicability and risk treatment plan'),
    paragraph(
      fill(answers, 'security_manager_title', 'security manager'),
      text(' is in charge of preparing the Statement of Applicability and the Risk Treatment Plan.'),
    ),
    paragraph(
      text('The following must be documented in the Statement of Applicability:'),
    ),
    bulletList([
      [text('Which security controls from Annex A of the ISO/IEC 27001 standard are applicable and which are not,')],
      [text('The justification for applicable and for non-applicable controls, and')],
      [text('Whether particular control is implemented or not (the status).')],
    ]),
    paragraph(
      text('On behalf of the risk owners, top management will accept all residual risks through the Statement of Applicability.'),
    ),
    paragraph(
      text('The purpose of the Risk Treatment Plan is to plan the implementation of controls that are not yet implemented. On behalf of the risk owners, top management will approve the Risk Treatment Plan.'),
    ),

    // ── 3.6. Reporting ──
    heading(2, '3.6. Reporting'),
    paragraph(
      fill(answers, 'risk_management_coordinator', 'risk management coordinator'),
      text(' will document the results of risk assessment and risk treatment, and all of the subsequent reviews, in the Risk Assessment and Treatment Report.'),
    ),
    paragraph(
      fill(answers, 'security_manager_title', 'security manager'),
      text(' will monitor the progress of implementation of the Risk Treatment Plan and report the results to '),
      fill(answers, 'top_executive_title', 'top executive'),
      text(' once a month.'),
    ),

    // ── 4. Managing records ──
    heading(1, '4. Managing records kept on the basis of this document'),
    table([
      [
        [text('Record name')],
        [text('Storage location')],
        [text('Person responsible')],
        [text('Controls for record protection')],
        [text('Retention time')],
      ],
      [
        [text('Risk Assessment Table')],
        [fill(answers, 'risk_documents_storage', 'storage location')],
        [fill(answers, 'risk_management_coordinator', 'coordinator')],
        [text('Only the person responsible for storage has the right to make entries into and changes to the Risk Assessment Table.')],
        [text('Data is stored permanently.')],
      ],
      [
        [text('Risk Treatment Table')],
        [fill(answers, 'risk_documents_storage', 'storage location')],
        [fill(answers, 'risk_management_coordinator', 'coordinator')],
        [text('Only the person responsible for storage has the right to make entries into and changes to the Risk Treatment Table.')],
        [text('Data is stored permanently.')],
      ],
      [
        [text('Risk Assessment and Treatment Report')],
        [fill(answers, 'risk_documents_storage', 'storage location')],
        [fill(answers, 'risk_management_coordinator', 'coordinator')],
        [text('The Report is prepared in read-only format.')],
        [text('The Report is stored for a period of '), fill(answers, 'retention_period', 'retention period'), text('.')],
      ],
      [
        [text('Statement of Applicability')],
        [fill(answers, 'risk_documents_storage', 'storage location')],
        [fill(answers, 'security_manager_title', 'security manager')],
        [text('Only the person responsible for storage has the right to make entries into and changes to the Statement of Applicability.')],
        [text('Older versions of SoA are stored for a period of '), fill(answers, 'retention_period', 'retention period'), text('.')],
      ],
      [
        [text('Risk Treatment Plan')],
        [fill(answers, 'risk_documents_storage', 'storage location')],
        [fill(answers, 'security_manager_title', 'security manager')],
        [text('Only the person responsible for storage has the right to make entries into and changes to the Risk Treatment Plan.')],
        [text('Older versions of Risk Treatment Plan are stored for a period of '), fill(answers, 'retention_period', 'retention period'), text('.')],
      ],
    ]),

    // ── 5. Validity and document management ──
    heading(1, '5. Validity and document management'),
    paragraph(
      text('This document is valid as of '),
      fill(answers, 'validity_date', 'validity date'),
      text('.'),
    ),
    paragraph(
      text('The owner of this document is '),
      fill(answers, 'document_owner', 'document owner'),
      text(', who must check and, if necessary, update the document at least '),
      fill(answers, 'review_frequency', 'review frequency'),
      text('.'),
    ),
    paragraph(
      text('When evaluating the effectiveness and adequacy of this document, the following criteria need to be considered:'),
    ),
    bulletList([
      [text('The number of incidents which occurred, but were not included in risk assessment.')],
      [text('The number of risks which were not treated adequately.')],
      [text('The number of errors in the risk assessment and risk treatment process because of unclear definition of roles and responsibilities.')],
    ]),

    // ── 6. Appendices ──
    heading(1, '6. Appendices'),
    bulletList([
      [text('Appendix 1 — Risk Assessment Table')],
      [text('Appendix 2 — Risk Treatment Table')],
      [text('Appendix 3 — Risk Assessment and Treatment Report')],
    ]),
  ],
  };
}
