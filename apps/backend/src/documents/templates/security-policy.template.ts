/**
 * Information Security Policy — ISO 27001 clauses 5.2 and 5.3.
 *
 * The wizard questions live in the database (document_templates / template_questions).
 * This file maps wizard answers to a ProseMirror document.
 */

import {
  WizardAnswers,
  ProseMirrorNode,
  text,
  italic,
  placeholder,
  fill,
  paragraph,
  heading,
  bulletList,
  splitLines,
} from './doc-control.template';

export const SECURITY_POLICY_TEMPLATE_CODE = 'SECURITY-POLICY';

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------

export function generateSecurityPolicyContent(
  answers: WizardAnswers,
  ctx: { organizationName: string },
): ProseMirrorNode {
  const company = answers.company_name?.trim() || ctx.organizationName;

  const refDocLines = splitLines(answers.reference_documents);
  const objectivesLines = splitLines(answers.security_objectives);

  return {
    type: 'doc',
    content: [

      // ── 1. Purpose, scope and users ──
      heading(1, '1. Purpose, scope and users'),
      paragraph(
        text('The aim of this top-level Policy is to define the purpose, direction, principles and basic rules for information security management.'),
      ),
      paragraph(
        text('This Policy is applied to the entire Information Security Management System (ISMS), as defined in the ISMS Scope Document.'),
      ),
      paragraph(
        text('Users of this document are all employees of '),
        { ...text(company), marks: [{ type: 'bold' }] },
        text(', as well as relevant external parties.'),
      ),

      // ── 2. Reference documents ──
      heading(1, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard, clauses 5.2, 5.3, 6.2, 7.4, and control A.6.3')],
        [text('ISMS Scope Document')],
        [text('Risk Assessment and Risk Treatment Methodology')],
        [text('Statement of Applicability')],
        [text('List of Legal, Regulatory, Contractual and Other Requirements')],
        [text('Incident Management Procedure')],
        ...refDocLines.length
          ? refDocLines.map((line: string) => [text(line)])
          : [[italic(placeholder('other relevant documents'))]],
      ]),

      // ── 3. Basic information security terminology ──
      heading(1, '3. Basic information security terminology'),
      paragraph(
        { ...text('Confidentiality'), marks: [{ type: 'bold' }] },
        text(' – characteristic of the information by which it is available only to authorized persons or systems.'),
      ),
      paragraph(
        { ...text('Integrity'), marks: [{ type: 'bold' }] },
        text(' – characteristic of the information by which it is changed only by authorized persons or systems in an allowed way.'),
      ),
      paragraph(
        { ...text('Availability'), marks: [{ type: 'bold' }] },
        text(' – characteristic of the information by which it can be accessed by authorized persons when it is needed.'),
      ),
      paragraph(
        { ...text('Information security'), marks: [{ type: 'bold' }] },
        text(' – preservation of confidentiality, integrity and availability of information.'),
      ),
      paragraph(
        { ...text('Information Security Management System'), marks: [{ type: 'bold' }] },
        text(' – part of overall management processes that takes care of planning, implementing, maintaining, reviewing, and improving the information security.'),
      ),

      // ── 4. Managing the information security ──
      heading(1, '4. Managing the information security'),

      // 4.1. Objectives and measurement
      heading(2, '4.1. Objectives and measurement'),
      paragraph(
        text('General objectives for the information security management system are the following: '),
        ...objectivesLines.length
          ? objectivesLines.map((line: string) => text(line))
          : [italic(placeholder('general security objectives'))],
        text('. These security objectives must be in line with the organization\'s objectives, strategy and business plans.'),
      ),
      paragraph(
        fill(answers, 'objectives_reviewer', 'objectives reviewer'),
        text(' is responsible for regularly reviewing these general ISMS objectives and setting new ones.'),
      ),
      paragraph(
        text('Objectives for individual security controls or groups of controls are proposed by heads of departments, and approved by '),
        fill(answers, 'security_manager_title', 'security manager'),
        text('.'),
      ),
      paragraph(
        text('All the objectives must be reviewed at least '),
        fill(answers, 'objectives_review_frequency', 'review frequency'),
        text('.'),
      ),
      paragraph(
        { ...text(company), marks: [{ type: 'bold' }] },
        text(' will measure the fulfillment of all the objectives:'),
      ),
      bulletList([
        [
          fill(answers, 'measurement_methodology_person', 'measurement methodology person'),
          text(' is responsible for setting the methods for measuring the achievement of the objectives.'),
        ],
        [text('The measurements will be performed at least once a year.')],
        [
          fill(answers, 'measurement_reporting_person', 'measurement reporting person'),
          text(' will analyze and evaluate the measurement results and report them to the top management as input materials for the Management review, and will record the details about measurement methods, frequency, and results in the Measurement Report.'),
        ],
      ]),

      // 4.2. Information security requirements
      heading(2, '4.2. Information security requirements'),
      paragraph(
        text('This Policy and the entire ISMS must be compliant with legal and regulatory requirements relevant to the company in the field of information security, as well as with contractual obligations.'),
      ),
      paragraph(
        text('A detailed list of all contractual and legal requirements is provided in the List of Legal, Regulatory and Contractual Obligations.'),
      ),

      // 4.3. Information security controls
      heading(2, '4.3. Information security controls'),
      paragraph(
        text('The process of selecting the controls (safeguards) is defined in the Risk Assessment and Risk Treatment Methodology.'),
      ),
      paragraph(
        text('The selected controls and their implementation status are listed in the Statement of Applicability.'),
      ),

      // 4.4. Responsibilities
      heading(2, '4.4. Responsibilities'),
      paragraph(text('Responsibilities for the ISMS are the following:')),
      bulletList([
        [
          fill(answers, 'top_executive_title', 'top executive'),
          text(' is responsible for ensuring that the ISMS is implemented and maintained according to this Policy, and for ensuring all necessary resources are available.'),
        ],
        [
          fill(answers, 'security_manager_title', 'security manager'),
          text(' is responsible for operational coordination of the ISMS as well as for reporting about the performance of the ISMS.'),
        ],
        [text('The executive team must review the ISMS at least once a year or each time a significant change occurs, and prepare minutes from that meeting. The purpose of the management review is to establish the suitability, adequacy and effectiveness of the ISMS.')],
        [
          fill(answers, 'training_awareness_title', 'training and awareness'),
          text(' will implement information security training and awareness programs for employees.'),
        ],
        [text('The protection of integrity, availability, and confidentiality of assets is the responsibility of the owner of each asset.')],
        [
          text('All security incidents or weaknesses must be reported to '),
          fill(answers, 'incident_receiver', 'incident receiver'),
          text('.'),
        ],
        [
          fill(answers, 'security_communicator', 'security communicator'),
          text(' will define which information related to information security will be communicated to which interested party (both internal and external), by whom and when.'),
        ],
      ]),

      // 4.5. Policy communication
      heading(2, '4.5. Policy communication'),
      paragraph(
        fill(answers, 'policy_communicator', 'policy communicator'),
        text(' has to ensure that all employees of '),
        { ...text(company), marks: [{ type: 'bold' }] },
        text(', as well as appropriate external parties, are familiar with this Policy.'),
      ),

      // ── 5. Support for ISMS implementation ──
      heading(1, '5. Support for ISMS implementation'),
      paragraph(
        text('Hereby the '),
        fill(answers, 'top_executive_title', 'top executive'),
        text(' declares that ISMS implementation and continual improvement will be supported with adequate resources in order to achieve all objectives set in this Policy, as well as satisfy all identified requirements.'),
      ),

      // ── 6. Validity and document management ──
      heading(1, '6. Validity and document management'),
      paragraph(
        text('This document is valid as of '),
        fill(answers, 'validity_date', 'validity date'),
        text('.'),
      ),
      paragraph(
        text('The owner of this document is '),
        fill(answers, 'document_owner', 'document owner'),
        text(', who must check and, if necessary, update the document at least '),
        fill(answers, 'review_frequency', 'update period'),
        text('.'),
      ),
      paragraph(
        text('When evaluating the effectiveness and adequacy of this document, the following criteria need to be considered:'),
      ),
      bulletList([
        [text('Number of employees and external parties who have a role in the ISMS, but are not familiar with this document')],
        [text('Non-compliance of the ISMS with the laws and regulations, contractual obligations, and other internal documents of the company')],
        [text('Ineffectiveness of ISMS implementation and maintenance')],
        [text('Unclear responsibilities for ISMS implementation')],
      ]),
    ],
  };
}
