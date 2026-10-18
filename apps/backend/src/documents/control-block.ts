import { PrismaService } from '../prisma/prisma.service';
import { ProseMirrorNode, heading, paragraph, row as tableRow, table, text } from './templates/doc-control.template';

/** A version as listed in the change history. */
export interface HistoryRow { version: string; date: Date; approvedBy: string; notes: string | null }

/** The live document control data (clause 7.5.2): never typed into the document itself. */
export interface ControlData {
  title: string;
  organization: string;
  code: string | null;
  confidentiality: string;
  owner: string;
  approver: string;
  reviewInterval: number | null;
  /** Newest first. */
  history: HistoryRow[];
}

const name = (u: { first_name: string; last_name: string } | null | undefined) =>
  u ? `${u.first_name} ${u.last_name}`.trim() : '';
const day = (d: Date) => d.toLocaleDateString('en-GB');
const bold = (value: string) => ({ ...text(value), marks: [{ type: 'bold' }] });

export async function loadControlData(prisma: PrismaService, documentId: string): Promise<ControlData | null> {
  const doc = await prisma.documentInstance.findUnique({
    where: { id: documentId },
    select: {
      title: true,
      code: true,
      confidentiality: true,
      update_interval: true,
      owner: { select: { first_name: true, last_name: true } },
      approver: { select: { first_name: true, last_name: true } },
      step: { select: { phase: { select: { project: { select: { organization: { select: { name: true } } } } } } } },
      versions: {
        orderBy: { published_at: 'desc' },
        select: { version: true, published_at: true, notes: true, approver: { select: { first_name: true, last_name: true } } },
      },
    },
  });
  if (!doc) return null;
  return {
    title: doc.title,
    organization: doc.step?.phase.project.organization.name ?? '',
    code: doc.code,
    confidentiality: doc.confidentiality,
    owner: name(doc.owner),
    approver: name(doc.approver),
    reviewInterval: doc.update_interval,
    history: doc.versions.map(v => ({ version: v.version, date: v.published_at, approvedBy: name(v.approver), notes: v.notes })),
  };
}

/**
 * The first page of every export: identification, ownership and approval of
 * the document, and its change history, taken from the library records.
 */
export function controlBlock(d: ControlData): ProseMirrorNode[] {
  const current = d.history[0];
  const row = (label: string, value: string) => [[bold(label)], [text(value || '—')]];
  return [
    paragraph(bold(d.organization)),
    heading(1, d.title.toUpperCase()),
    // Label / value pairs: no header row.
    { type: 'table', content: [
      row('Code', d.code ?? ''),
      row('Version', current ? current.version : 'Draft, not approved'),
      row('Date of version', current ? day(current.date) : ''),
      row('Approved by', current?.approvedBy ?? ''),
      row('Owner', d.owner),
      row('Review', d.reviewInterval ? `Every ${d.reviewInterval} months` : ''),
      row('Confidentiality level', d.confidentiality),
    ].map(cells => tableRow(cells)) },
    heading(2, 'Change history'),
    d.history.length
      ? table([
          [[text('Date')], [text('Version')], [text('Approved by')], [text('Description of change')]],
          ...d.history.map(h => [[text(day(h.date))], [text(h.version)], [text(h.approvedBy || '—')], [text(h.notes ?? (h === d.history[d.history.length - 1] ? 'First approved version' : '—'))]]),
        ])
      : paragraph(text('No approved version yet.')),
  ];
}
