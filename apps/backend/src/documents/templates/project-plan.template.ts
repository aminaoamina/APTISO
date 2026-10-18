/**
 * Project Plan for ISMS Implementation — Phase 1, Step 3.
 *
 * The wizard questions for this template live in the database
 * (document_templates / template_questions, seeded by migration). This file
 * contains only the mapping from wizard answers to a structured
 * Tiptap/ProseMirror document.
 */

export const PROJECT_PLAN_TEMPLATE_CODE = 'PROJECT-PLAN';

import type { ProseMirrorNode } from './doc-control.template';
import {
  text,
  fill,
  paragraph,
  heading,
  bulletList,
  table,
  type WizardAnswers,
} from './doc-control.template';

const splitLines = (value: string | undefined): string[] =>
  (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const DEFAULT_PROJECT_RESULTS = `Procedure for Document and Record Control – procedure prescribing basic rules for writing, approving, distributing and updating documents and records
Procedure for Identification of Requirements – procedure for identification of statutory, regulatory, contractual and other obligations
ISMS Scope Document – a document precisely defining assets, locations, technology, etc. that are part of the scope
Information Security Policy – this is a key document used by management to control information security management
Risk Assessment and Risk Treatment Methodology – describes the methodology for managing information risks
Risk Assessment Table – the table is the result of assessment of asset values, threats and vulnerabilities
Risk Treatment Table – a table in which appropriate security controls are selected for each unacceptable risk
Risk Assessment and Treatment Report – a document containing all key documents made in the process of risk assessment and risk treatment
Statement of Applicability – a document that determines the objectives and applicability of each control according to Annex A of the ISO 27001 standard
Risk Treatment Plan – an implementation document specifying controls to be implemented, who is responsible for implementation, deadlines and resources
Training and Awareness Plan – a detailed overview of how employees will be trained to execute planned tasks, and how they will be made aware of the importance of information security
Procedure for Internal Audit – defines how auditors are selected, how audit programs are written, how audits are conducted and how audit results are reported
Procedure for Corrective Action – describes the process of implementation for corrective and preventive actions
Measurement Report – summarizes the objectives of the ISMS, the measurement method, the frequency of measurement, and the results
Management Review Minutes – a form used to create minutes from the management meeting held to review ISMS adequacy`;

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------

export function generateProjectPlanContent(
  answers: WizardAnswers,
  _ctx: { organizationName: string },
): ProseMirrorNode {
  const resultsText = answers.project_results?.trim() || DEFAULT_PROJECT_RESULTS;
  const results = splitLines(resultsText);

  return {
    type: 'doc',
    content: [

      // ---------------- 1. Purpose, scope and users ----------------
      heading(1, '1. Purpose, scope and users'),
      paragraph(
        text(
          'The purpose of the Project Plan is to clearly define the objective of the Information Security Management System (ISMS) implementation project, documents to be written, deadlines, and roles and responsibilities in the project.',
        ),
      ),
      paragraph(
        text(
          'The Project Plan is applied to all activities performed in the ISMS implementation project.',
        ),
      ),
      paragraph(
        text('Users of this document are members of '),
        fill(answers, 'top_management_designation', 'top management designation'),
        text(' and members of the project team.'),
      ),

      // ---------------- 2. Reference documents ----------------
      heading(1, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard')],
        ...splitLines(answers.reference_documents).map(
          (line): ProseMirrorNode[] => [text(line)],
        ),
      ]),

      // ---------------- 3. ISMS implementation project ----------------
      heading(1, '3. ISMS implementation project'),

      // 3.1 Project objective
      heading(2, '3.1. Project objective'),
      paragraph(
        text('The project objective is to implement the Information Security Management System in accordance with the ISO 27001 standard by '),
        fill(answers, 'target_date', 'targeted date'),
        text(' at the latest.'),
      ),

      // 3.2 Project results
      heading(2, '3.2. Project results'),
      paragraph(
        text(
          'During the ISMS implementation project, the following documents will be written (some of these documents contain appendices that are not expressly stated here):',
        ),
      ),
      bulletList(results.map((r): ProseMirrorNode[] => [text(r)])),

      // 3.3 Deadlines
      heading(2, '3.3. Deadlines'),
      paragraph(
        text(
          'Deadlines for acceptance of individual documents in the course of ISMS implementation are as follows:',
        ),
      ),
      paragraph(fill(answers, 'deadlines_overview', 'describe the deadlines for individual documents')),

      // 3.4 Project organization
      heading(2, '3.4. Project organization'),

      heading(3, '3.4.1. Project sponsor'),
      paragraph(
        text(
          'Each project has an assigned "sponsor" who does not actively participate in the project. The project sponsor must be regularly briefed by the project manager about the project status, and intervene if the project is halted.',
        ),
      ),
      paragraph(
        text('The project sponsor is '),
        fill(answers, 'project_sponsor', 'job title of the top executive overseeing security'),
        text('.'),
      ),

      heading(3, '3.4.2. Project manager'),
      paragraph(
        text(
          'The role of the project manager is to ensure resources necessary for project implementation, to coordinate the project, to inform the sponsor about the progress, and to carry out administrative work related to the project.',
        ),
      ),
      paragraph(
        text('The project manager is '),
        fill(answers, 'project_manager', 'name and job title of the project manager'),
        text('.'),
      ),

      heading(3, '3.4.3. Project team'),
      paragraph(
        text(
          'The role of the project team is to assist in various aspects of project implementation, to perform tasks as specified in the project, and to make decisions about various issues that require a multidisciplinary approach.',
        ),
      ),
      paragraph(text('Table of participants in the project')),
      table([
        [ [text('Name')], [text('Organizational unit')], [text('Job title')], [text('Phone')], [text('E-mail')] ],
        ...parseTeamTable(answers.team_members),
      ]),

      // 3.5 Main project risks
      heading(2, '3.5. Main project risks'),
      paragraph(text('The main risks in the implementation of the project are the following:')),
      paragraph(fill(answers, 'project_risks', 'project main risks')),
      paragraph(text('Measures to reduce the abovementioned risks are the following:')),
      paragraph(fill(answers, 'risk_controls', 'project risks controls')),

      // 3.6 Tools
      heading(2, '3.6. Tools for project implementation, reporting'),
      paragraph(
        text('A shared folder including all documents produced during the project will be created on '),
        fill(answers, 'storage_folder', 'storage folder'),
        text(
          '. All members of the project team will have access to these documents. Only the project manager and the members of the project team will be authorized to make changes and delete files.',
        ),
      ),
      paragraph(
        text(
          'The project manager will prepare a project implementation report on a monthly basis and forward it to the project sponsor.',
        ),
      ),

      // ---------------- 4. Managing records ----------------
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
          [text('Project implementation report')],
          [text('Shared folder for project-related activities')],
          [text('Project manager')],
          [text('Only the project manager is authorized to edit data.')],
          [fill(answers, 'record_storage_period', 'storage period')],
        ],
      ]),

      // ---------------- 5. Validity and document management ----------------
      heading(1, '5. Validity and document management'),
      paragraph(text('This document is valid as of '), fill(answers, 'validity_date', 'validity date'), text('.')),
      paragraph(
        text('The owner of this document is '),
        fill(answers, 'document_owner', 'job title for management document owner'),
        text(', who must check and, if necessary, update the document at least '),
        fill(answers, 'update_period', 'update period'),
        text('.'),
      ),
      paragraph(text('When evaluating the effectiveness and adequacy of this document, the following criteria need to be considered:')),
      bulletList([
        [text('Whether all employees engaged in the project perform their activities in line with this document')],
        [text('Whether all project deadlines are met')],
      ]),
    ],
  };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/** Parse free-text team members into table rows. */
function parseTeamTable(raw: string | undefined): ProseMirrorNode[][][] {
  const lines = (raw ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [[
      [text(' ')],
      [text(' ')],
      [text(' ')],
      [text(' ')],
      [text(' ')],
    ]];
  }

  return lines.map((line): ProseMirrorNode[][] => {
    const parts = line.split(/[,;|]/).map((p) => p.trim());
    return [
      [text(parts[0] || ' ')],
      [text(parts[1] || ' ')],
      [text(parts[2] || ' ')],
      [text(parts[3] || ' ')],
      [text(parts[4] || ' ')],
    ];
  });
}
