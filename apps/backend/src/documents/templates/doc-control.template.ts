/**
 * Procedure for Document and Record Control — the first APTISO document
 * template (ISO/IEC 27001 clause 7.5 / control A.5.33).
 *
 * The wizard questions for this template live in the database
 * (document_templates / template_questions, seeded by migration). This file
 * contains only what code must own: the mapping from wizard answers to a
 * structured Tiptap/ProseMirror document.
 *
 * Rules:
 *  - Answers are inserted as plain text nodes at known positions in the
 *    structure (never via string replacement over serialized HTML).
 *  - Missing answers become visible italic placeholders such as
 *    "[job title for publishing documents]" so APTISO never invents
 *    organizational facts.
 */

export const DOC_CONTROL_TEMPLATE_CODE = 'DOC-CONTROL';

export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
}

export type WizardAnswers = Record<string, string>;

// ---------------------------------------------------------------
// Node helpers
// ---------------------------------------------------------------

export const text = (value: string): ProseMirrorNode => ({ type: 'text', text: value });

export const italic = (node: ProseMirrorNode): ProseMirrorNode => ({
  ...node,
  marks: [{ type: 'italic' }],
});

/** Visible placeholder for a missing answer — never invented content. */
export const placeholder = (label: string): ProseMirrorNode =>
  italic(text(`[${label}]`));

/** Answer if provided, otherwise a visible placeholder. */
export const fill = (answers: WizardAnswers, key: string, fallbackLabel: string): ProseMirrorNode => {
  const value = answers[key]?.trim();
  return value ? text(value) : placeholder(fallbackLabel);
};

export const paragraph = (...children: ProseMirrorNode[]): ProseMirrorNode => ({
  type: 'paragraph',
  content: children,
});

export const emptyParagraph = (): ProseMirrorNode => ({ type: 'paragraph' });

export const heading = (level: number, value: string): ProseMirrorNode => ({
  type: 'heading',
  attrs: { level, textAlign: 'left' },
  content: [text(value)],
});

export const bulletItem = (...children: ProseMirrorNode[]): ProseMirrorNode => ({
  type: 'listItem',
  content: [paragraph(...children)],
});

export const bulletList = (items: ProseMirrorNode[][]): ProseMirrorNode => ({
  type: 'bulletList',
  content: items.map((children) => bulletItem(...children)),
});

export const cell = (children: ProseMirrorNode[], header = false): ProseMirrorNode => ({
  type: header ? 'tableHeader' : 'tableCell',
  content: [paragraph(...children)],
});

export const row = (cells: ProseMirrorNode[][], header = false): ProseMirrorNode => ({
  type: 'tableRow',
  content: cells.map((c) => cell(c, header)),
});

export const table = (rows: ProseMirrorNode[][][]): ProseMirrorNode => ({
  type: 'table',
  content: rows.map((cells, i) => row(cells, i === 0)),
});

/**
 * Answers are inserted into sentences that end with their own punctuation:
 * drops the extra "." after an answer that already ends a sentence ("Done.." → "Done.").
 */
export function tidyPunctuation(node: ProseMirrorNode): ProseMirrorNode {
  if (!node.content) return node;
  const content = node.content.map(tidyPunctuation).filter((child, i, all) => {
    const before = all[i - 1];
    return !(child.type === 'text' && child.text === '.' && before?.type === 'text' && /[.!?]\s*$/.test(before.text ?? ''));
  });
  return { ...node, content };
}

export const splitLines = (value: string | undefined): string[] =>
  (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------

export function generateDocControlContent(
  answers: WizardAnswers,
  ctx: { organizationName: string },
): ProseMirrorNode {
  const company = answers.company_name?.trim() || ctx.organizationName;

  return {
    type: 'doc',
    content: [

      // ---------------- 1. Purpose, scope and users ----------------
      heading(1, '1. Purpose, scope and users'),
      paragraph(
        text(
          'The purpose of this procedure is to ensure control over creation, approval, distribution, usage and updates of documents and records (also called: documented information) used in the Information Security Management System (ISMS).',
        ),
      ),
      paragraph(
        text(
          `This procedure is applied to ${answers.applicability === 'All company documentation'
            ? `all documents and records of ${company}, including those related to the ISMS`
            : 'all documents and records related to the ISMS'}, regardless of whether the documents and records were created inside the organization or whether they are of external origin. This procedure encompasses all documents and records, stored in any possible form – paper, audio, video, etc.`,
        ),
      ),
      paragraph(text('Users of this document are all employees of '), text(company), text(' inside the scope of the ISMS.')),

      // ---------------- 2. Reference documents ----------------
      heading(1, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard, clause 7.5 and control A.5.33')],
        [text('Information Security Policy')],
        [text('Information Classification Policy')],
        ...splitLines(answers.reference_documents).map((line) => [text(line)] as ProseMirrorNode[]),
      ]),

      // ---------------- 3. Control of internal documents ----------------
      heading(1, '3. Control of internal documents'),
      paragraph(text('Internal documents are all documents created inside the company.')),

      heading(2, '3.1. Document formatting'),
      paragraph(text('The document text is written using '), fill(answers, 'formatting_standard', 'standard formatting of ISMS documents and records'), text('.')),
      paragraph(
        text(
          'The document header contains company name and confidentiality level. The footer contains document name, current version and date of document, and number of pages.',
        ),
      ),
      paragraph(text('Every document must also define its users.')),

      heading(2, '3.2. Document approval'),
      paragraph(
        text(
          'Before sending for approval, each document must be reviewed by at least one person who has an interest in, or competence about, the document content.',
        ),
      ),
      paragraph(text('The documents are approved by: '), fill(answers, 'approval_responsibility', 'specify who is approving what kind of documents'), text('.')),
      paragraph(text('The documents are approved in the following way: '), fill(answers, 'approval_method', 'document approval method'), text('.')),

      heading(2, '3.3. Publishing and distributing documents; withdrawal from use'),
      heading(3, '3.3.1. Documents with the lowest confidentiality level'),
      paragraph(
        text(
          'In case of documents to which access is allowed for all employees within ISMS scope, ',
        ),
        fill(answers, 'publishing_role', 'job title for publishing documents'),
        text(' must publish them '),
        fill(answers, 'publishing_method', 'how the documents are published'),
        text(
          ' with reading rights only. When a new document or new document version is published, ',
        ),
        fill(answers, 'distribution_role', 'job title for distributing documents'),
        text(' must inform all employees listed as users of the document '),
        fill(answers, 'notification_method', 'how the users are informed about published documents'),
        text(
          ', and distribute a printed version of the document (if such exists).',
        ),
      ),
      paragraph(
        text('If there is an obsolete version of the document, '),
        fill(answers, 'publishing_role', 'job title for publishing documents'),
        text(' must '),
        fill(answers, 'obsolete_handling', 'describe how the obsolete documents are removed'),
        text(
          '. If there are obsolete versions of printed documents, ',
        ),
        fill(answers, 'distribution_role', 'job title for distributing documents'),
        text(
          ' must collect all such documents and destroy all copies except the signed original, which must be duly stored – such originals must be marked as "Obsolete" using a marker pen.',
        ),
      ),
      heading(3, '3.3.2. Documents with higher confidentiality level'),
      paragraph(
        text(
          'Documents that have a higher confidentiality level, as specified in the Information Classification Policy, and of which distribution is limited, are published by the document owner on the intranet with reading rights only, in a folder to which access is granted only to persons specified on the document\'s distribution list. The document owner must notify all persons on the distribution list ',
        ),
        fill(answers, 'notification_method', 'how the users are informed about published documents'),
        text(' about such a document.'),
      ),
      paragraph(
        text(
          'If there is an older version of the document, the document owner must delete it from the valid documents folder and move it to the folder containing obsolete documents, which can be accessed only by persons specified on the document distribution list.',
        ),
      ),

      heading(2, '3.4. Document updates'),
      paragraph(
        text(
          'The person listed as document owner has the responsibility for updating the document. Updates are performed in line with the frequency defined for each document, but at least once a year.',
        ),
      ),
      paragraph(
        text(
          'All changes to the document must be made using "Track changes," making visible only the revisions to the previous version and must be briefly described in the "Change History" table; if Track changes option is unavailable, or if the changes are too numerous, then the Track changes option is not used.',
        ),
      ),
      paragraph(
        text(
          'Each document should preferably have a "Change History" table used to record every change made to the document.',
        ),
      ),

      heading(2, '3.5. Records control'),
      paragraph(
        text(
          'Each internal document in the ISMS must define how records resulting from the use of such a document should be managed, i.e., it must specify the following: (1) record title, (2) storage location, (3) person responsible for storage, (4) controls for record protection, and (5) retention time.',
        ),
      ),
      paragraph(
        text(
          'Employees of the company may access stored records only after obtaining permission from the person designated as the person responsible for storing individual records. If the sensitivity of certain records is such that permission for access must be obtained from a different person, this must be stated in the concerned internal document in the chapter describing records control.',
        ),
      ),
      paragraph(text('Records are destroyed according to the Retention Policy.')),

      // ---------------- 4. Documents of external origin ----------------
      heading(1, '4. Documents of external origin'),
      paragraph(
        text('Each external document that is important for the ISMS must be recorded in the '),
        fill(answers, 'external_register_location', 'where the external documents are recorded'),
        text('. The '),
        fill(answers, 'external_register_location', 'where the external documents are recorded'),
        text(
          ' must contain the following information: (1) document number, (2) sender, (3) document name, (4) date of receipt, (5) name of the person to whom the document has been forwarded.',
        ),
      ),
      paragraph(
        text(
          'The person who receives external document (either in digital or paper format) or email that is important for the ISMS must record it in the ',
        ),
        fill(answers, 'external_register_location', 'where the external documents are recorded'),
        text('.'),
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
          [fill(answers, 'record_name', 'records of external correspondence')],
          [fill(answers, 'record_storage_location', 'storage location')],
          [fill(answers, 'record_responsible', 'person responsible for storage')],
          [fill(answers, 'record_protection', 'controls for record protection')],
          [
            text('Records are stored for a period of '),
            fill(answers, 'record_retention', 'storage period'),
            text('.'),
          ],
        ],
      ]),
      paragraph(
        text('Only '),
        fill(answers, 'record_responsible', 'job title responsible for this record'),
        text(' can grant other employees access to the '),
        fill(answers, 'record_name', 'name of this record'),
        text('.'),
      ),

      // ---------------- 6. Validity and document management ----------------
      heading(1, '6. Validity and document management'),
      paragraph(text('This document is valid as of '), fill(answers, 'validity_date', 'validity date'), text('.')),
      paragraph(
        text('The owner of this document is '),
        fill(answers, 'document_owner', 'job title for document owner'),
        text(', who must check and, if necessary, update the document '),
        fill(answers, 'review_frequency', 'review frequency (e.g. every 12 months)'),
        text('.'),
      ),
      paragraph(
        text(
          'When evaluating the effectiveness and adequacy of this document, the following criteria need to be considered:',
        ),
      ),
      bulletList([
        [text('Number of obsolete or out-of-date documents')],
        [text('Number of documents that were not distributed to intended employees')],
        [text('Number of documents for which no record is kept or which are not appropriately stored')],
      ]),
    ],
  };
}
