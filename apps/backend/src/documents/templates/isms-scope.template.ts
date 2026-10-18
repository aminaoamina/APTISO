/**
 * ISMS Scope Document — ISO 27001 clause 4.3.
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

export const ISMS_SCOPE_TEMPLATE_CODE = 'ISMS-SCOPE';

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------

export function generateIsmsScopeContent(
  answers: WizardAnswers,
  ctx: { organizationName: string },
): ProseMirrorNode {
  const company = answers.company_name?.trim() || ctx.organizationName;

  const jobTitlesLines = splitLines(answers.job_titles);
  const departmentsLines = splitLines(answers.departments);
  const processesLines = splitLines(answers.processes);
  const locationsLines = splitLines(answers.locations);
  const itInfraLines = splitLines(answers.it_infrastructure);
  const exclusionsLines = splitLines(answers.exclusions);

  return {
    type: 'doc',
    content: [

      // ── 1. Purpose, scope, and users ──
      heading(1, '1. Purpose, scope, and users'),
      paragraph(
        text('The purpose of this document is to clearly define the boundaries of the Information Security Management System (ISMS) in '),
        { ...text(company || '[company name]'), marks: [{ type: 'bold' }] },
        text('.'),
      ),
      paragraph(
        text('This document is applied to all documentation and activities within the ISMS.'),
      ),
      paragraph(
        text('Users of this document are members of company\'s management, members of the project team implementing the ISMS, and '),
        ...jobTitlesLines.length
          ? jobTitlesLines.map((line: string) => text(line))
          : [italic(placeholder('job titles of employees to access the ISMS Scope Document'))],
        text('.'),
      ),

      // ── 2. Reference documents ──
      heading(1, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard, clause 4.3')],
        [text('Project Plan document for ISO 27001 implementation')],
        [text('List of Legal, Regulatory, Contractual and Other Requirements')],
      ]),

      // ── 3. Definition of ISMS scope ──
      heading(1, '3. Definition of ISMS scope'),
      paragraph(
        text('The company needs to define the boundaries of its ISMS in order to decide which information it wants to protect. Such information will need to be protected no matter whether it is additionally stored, processed or transferred in or out of the ISMS scope. The fact that some information is available outside of the scope doesn\'t mean the security measures won\'t apply to it – this only means that the responsibility for applying the security measures will be transferred to a third party who manages that information.'),
      ),
      paragraph(
        text('Taking into account the legal, regulatory, contractual and other requirements, the ISMS scope is defined as specified in the following items:'),
      ),

      // ── 3.1. Departments ──
      heading(2, '3.1. Departments'),
      paragraph(
        text('The following departments are included in the ISMS scope: '),
        ...departmentsLines.length
          ? departmentsLines.map((line: string) => text(line))
          : [italic(placeholder('departments included in ISMS scope'))],
        text('.'),
      ),

      // ── 3.2. Processes and services ──
      heading(2, '3.2. Processes and services'),
      paragraph(
        text('The following processes and services are included in the ISMS scope: '),
        ...processesLines.length
          ? processesLines.map((line: string) => text(line))
          : [italic(placeholder('processes and services included in ISMS scope'))],
        text('.'),
      ),

      // ── 3.3. Locations ──
      heading(2, '3.3. Locations'),
      paragraph(
        text('The following locations are included in the ISMS scope: '),
        ...locationsLines.length
          ? locationsLines.map((line: string) => text(line))
          : [italic(placeholder('locations included in ISMS scope'))],
        text('.'),
      ),

      // ── 3.4. IT infrastructure ──
      heading(2, '3.4. IT infrastructure'),
      paragraph(
        text('The following IT infrastructure is included in the scope: '),
        ...itInfraLines.length
          ? itInfraLines.map((line: string) => text(line))
          : [italic(placeholder('IT infrastructure included in ISMS scope'))],
        text('.'),
      ),

      // ── 3.5. Exclusions from the scope ──
      heading(2, '3.5. Exclusions from the scope'),
      paragraph(
        text('The following is not included in the scope: '),
        ...exclusionsLines.length
          ? exclusionsLines.map((line: string) => text(line))
          : [italic(placeholder('exclusions from the ISMS scope'))],
        text('.'),
      ),

      // ── 4. Validity and document management ──
      heading(1, '4. Validity and document management'),
      paragraph(
        text('This document is valid as of '),
        fill(answers, 'validity_date', 'validity date'),
        text('.'),
      ),
      paragraph(
        text('The owner of this document is '),
        fill(answers, 'document_owner', 'job title for management document owner'),
        text(', who must check and, if necessary, update the document at least '),
        fill(answers, 'review_frequency', 'update period'),
        text('.'),
      ),
      paragraph(
        text('When evaluating the effectiveness and adequacy of this document, the following criteria need to be considered:'),
      ),
      bulletList([
        [text('Number of incidents arising from unclear definition of the ISMS scope')],
        [text('Number of corrective actions taken due to an inadequately defined ISMS scope')],
        [text('Time put in by employees implementing the ISMS to resolve dilemmas concerning the unclear scope')],
      ]),
    ],
  };
}
