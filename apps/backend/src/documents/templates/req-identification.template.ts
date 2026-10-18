/**
 * Procedure for Identification of Requirements — Phase 1, Step 4.
 *
 * The wizard questions for this template live in the database
 * (document_templates / template_questions, seeded by migration). This file
 * contains only the mapping from wizard answers to a structured
 * Tiptap/ProseMirror document.
 */

export const REQ_IDENTIFICATION_TEMPLATE_CODE = 'REQ-IDENTIFICATION';

import {
  text,
  fill,
  paragraph,
  heading,
  bulletList,
  table,
  type WizardAnswers,
} from './doc-control.template';
import type { ProseMirrorNode } from './doc-control.template';

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------

export function generateReqIdentificationContent(
  answers: WizardAnswers,
  ctx: { organizationName: string },
): ProseMirrorNode {
  const company = answers.company_name?.trim() || ctx.organizationName;
  const compliance = answers.compliance_job_title?.trim() || '[job title for compliance]';

  return {
    type: 'doc',
    content: [

      // ---------------- 1. Purpose, scope and users ----------------
      heading(1, '1. Purpose, scope and users'),
      paragraph(
        text(
          'The purpose of this document is to define the process of identification of interested parties, as well as legal, regulatory, contractual and other requirements related to information security, and responsibilities for their fulfillment.',
        ),
      ),
      paragraph(
        text(
          'This document is applied to the entire Information Security Management System (ISMS).',
        ),
      ),
      paragraph(text('Users of this document are all employees of '), text(company), text('.')),

      // ---------------- 2. Reference documents ----------------
      heading(1, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard, clause 4.2 and control A.5.31')],
        [text('Information Security Policy')],
      ]),

      // ---------------- 3. Identification of interested parties ----------------
      heading(1, '3. Identification of interested parties and their requirements'),
      paragraph(
        text(compliance),
        text(
          ' is responsible for identifying (1) all persons or organizations that can affect or can be affected by information security management (interested parties), and (2) all related legal, regulatory, contractual and other requirements.',
        ),
      ),
      paragraph(
        text(
          'The main requirements that need to be identified are the security requirements of interested parties, but requirements related to climate change can also be identified if they are relevant for the ISMS.',
        ),
      ),
      paragraph(
        text(
          'The same person will define who will be responsible for compliance with each individual requirement, and which interested parties are to be notified when changes occur.',
        ),
      ),
      paragraph(
        text('Further, this person must list all requirements, interested parties, and responsible persons in the List of Legal, Regulatory, Contractual and Other Requirements, and publish that list in '),
        fill(answers, 'publishing_guidelines', 'guidelines for publishing the list'),
        text('.'),
      ),
      paragraph(
        text(
          'Every employee must notify this person if he/she comes across any new legal, regulatory, contractual or other requirement that might be relevant to information security.',
        ),
      ),

      // ---------------- 4. Reviewing and evaluation ----------------
      heading(1, '4. Reviewing and evaluation'),
      paragraph(
        text(compliance),
        text(
          ' is responsible for reviewing the List of Legal, Regulatory, Contractual and Other Requirements at least every 6 months, and for updating it as necessary. This same person will notify all relevant employees of the company upon each update.',
        ),
      ),
      paragraph(
        text(
          'The Internal Auditor is responsible for evaluating the compliance of ISMS with relevant legal, regulatory, and contractual requirements at least once a year.',
        ),
      ),

      // ---------------- 5. Managing records ----------------
      heading(1, '5. Managing records kept on the basis of this document'),
      table([
        [
          [text('Record name')],
          [text('Storage location')],
          [text('Person responsible for storage')],
          [text('Controls for record protection')],
          [text('Retention time')],
        ],
        [
          [text('List of Legal, Regulatory, Contractual and Other Requirements')],
          [text("Company's intranet")],
          [text(compliance)],
          [text('Only '), text(compliance), text(' is authorized to edit data.')],
          [text('Older versions of the List are archived for 3 years.')],
        ],
      ]),

      // ---------------- 6. Validity and document management ----------------
      heading(1, '6. Validity and document management'),
      paragraph(text('This document is valid as of '), fill(answers, 'validity_date', 'validity date'), text('.')),
      paragraph(
        text('The owner of this document is '),
        fill(answers, 'document_owner', 'job title for management document owner'),
        text(', who must check and, if necessary, update the document at least '),
        fill(answers, 'update_period', 'update period'),
        text('.'),
      ),
      paragraph(
        text(
          'When evaluating the effectiveness and adequacy of this document, the following criteria need to be considered:',
        ),
      ),
      bulletList([
        [text("Number of company's obligations that existed, but were not identified")],
        [text('Number or amount of penalties paid, resulting from lack of compliance with obligations')],
        [text('Number of days that the compliance with obligations was late')],
      ]),

      // ---------------- 7. Appendices ----------------
      heading(1, '7. Appendices'),
      bulletList([
        [text('\u2013 Appendix 1 \u2013 List of Legal, Regulatory, Contractual and Other Requirements')],
      ]),
    ],
  };
}
