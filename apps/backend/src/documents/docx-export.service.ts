import { Injectable, NotFoundException } from '@nestjs/common';
import { fileName } from './library.service';
import { controlBlock, loadControlData } from './control-block';
import { PrismaService } from '../prisma/prisma.service';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  PageNumber,
  Footer,
  Header,
  type IParagraphOptions,
} from 'docx';

// ─── ProseMirror types ──────────────────────────────────────────
interface PMMark { type: string; attrs?: Record<string, unknown> }
interface PMNode { type: string; attrs?: Record<string, unknown>; content?: PMNode[]; marks?: PMMark[]; text?: string }

// ─── Word styling constants ──────────────────────────────────────
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 0 };
const TABLE_BORDERS = {
  top: BORDER, bottom: BORDER, left: BORDER, right: BORDER,
  insideHorizontal: BORDER, insideVertical: BORDER,
};

function italic(text: string): TextRun {
  return new TextRun({ text, italics: true });
}

// ─── ProseMirror → docx converter ───────────────────────────────

function buildRuns(node: PMNode, forceBold = false): TextRun[] {
  if (node.type === 'text' && node.text != null) {
    const opts: Record<string, unknown> = { text: node.text };
    const hasExplicitBold = node.marks?.some((m) => m.type === 'bold');
    if (forceBold || hasExplicitBold) opts.bold = true;
    if (node.marks) {
      for (const m of node.marks) {
        if (m.type === 'italic') opts.italics = true;
        if (m.type === 'underline') opts.underline = {};
        if (m.type === 'strike') opts.strike = true;
        if (m.type === 'code') opts.font = 'Courier New';
      }
    }
    return [new TextRun(opts)];
  }
  if (node.content) {
    return node.content.flatMap((c) => buildRuns(c, forceBold));
  }
  return [];
}

function headingSpacing(level: number): { before: number; after: number } {
  switch (level) {
    case 1: return { before: 240, after: 120 };
    case 2: return { before: 200, after: 80 };
    case 3: return { before: 160, after: 60 };
    default: return { before: 120, after: 60 };
  }
}

function headingStyle(level: number): { size: number } {
  switch (level) {
    case 1: return { size: 40 };
    case 2: return { size: 32 };
    case 3: return { size: 28 };
    default: return { size: 24 };
  }
}

function convertParagraph(node: PMNode): Paragraph {
  const runs = buildRuns(node);
  const level = node.type === 'heading' ? (node.attrs?.level as number | undefined) : undefined;

  const opts: Record<string, unknown> = {
    children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
    spacing: { after: 120 },
  };

  if (level) {
    opts.heading = HeadingLevel.HEADING_1;
    opts.spacing = headingSpacing(level);
    opts.run = { bold: true, size: headingStyle(level).size, font: 'Calibri' };
  }

  if (node.attrs?.textAlign === 'center') opts.alignment = AlignmentType.CENTER;
  else if (node.attrs?.textAlign === 'right') opts.alignment = AlignmentType.RIGHT;

  return new Paragraph(opts as IParagraphOptions);
}

function convertTableCell(node: PMNode, isHeader: boolean): TableCell {
  const runs: TextRun[] = [];
  if (node.content) {
    for (const para of node.content) {
      if (para.content) {
        for (const child of para.content) {
          runs.push(...buildRuns(child, isHeader));
        }
      }
    }
  }

  return new TableCell({
    children: [
      new Paragraph({
        children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
        spacing: { after: 0 },
      }),
    ],
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    ...(isHeader ? { shading: { fill: 'D9E2F3', color: 'D9E2F3' } } : {}),
  });
}

function convertTable(node: PMNode): Table {
  const rows = (node.content ?? [])
    .filter((r) => r.type === 'tableRow')
    .map((rowNode, rowIdx) => {
      const isHeader = rowIdx === 0;
      const cells = (rowNode.content ?? [])
        .filter((c) => c.type === 'tableCell' || c.type === 'tableHeader')
        .map((c) => convertTableCell(c, isHeader));
      return new TableRow({ children: cells });
    });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
  });
}

function extractListText(node: PMNode): string[] {
  const texts: string[] = [];
  if (node.content) {
    for (const child of node.content) {
      if (child.type === 'paragraph' && child.content) {
        const t = child.content.map((c) => c.text ?? '').join('');
        if (t) texts.push(t);
      }
    }
  }
  if (texts.length === 0 && node.text) texts.push(node.text);
  return texts.length > 0 ? texts : [''];
}

function convertNode(node: PMNode): (Paragraph | Table)[] {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).flatMap(convertNode);
    case 'paragraph':
    case 'heading':
      return [convertParagraph(node)];
    case 'table':
      return [convertTable(node)];
    case 'bulletList':
      return (node.content ?? []).flatMap((item) => {
        return extractListText(item).map((t) =>
          new Paragraph({ children: [new TextRun(t)], bullet: { level: 0 }, spacing: { after: 60 } }),
        );
      });
    case 'orderedList':
      return (node.content ?? []).flatMap((item) => {
        return extractListText(item).map((t) =>
          new Paragraph({
            children: [new TextRun(t)],
            numbering: { reference: 'ordered-list', level: 0 },
            spacing: { after: 60 },
          }),
        );
      });
    case 'listItem':
      return [convertParagraph(node)];
    case 'hardBreak':
      return [new Paragraph({ children: [new TextRun({ text: '' })] })];
    default:
      if (node.content) return node.content.flatMap(convertNode);
      return [];
  }
}

// ─── Service ─────────────────────────────────────────────────────

@Injectable()
export class DocxExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportDocument(
    documentId: string,
    overrideContent?: PMNode,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await this.prisma.documentInstance.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new NotFoundException('Document not found');

    const control = (await loadControlData(this.prisma, documentId))!;
    const company = control.organization || doc.title;

    // Use overrideContent (Tiptap edits) or fall back to stored content
    const contentToExport = overrideContent ?? (doc.content as unknown as PMNode);

    // Convert ProseMirror → docx paragraphs/tables
    // Like the library PDF, the file opens with the live document control data.
    const bodyElements = convertNode({ type: 'doc', content: [...controlBlock(control), ...(contentToExport.content ?? [])] });

    const numberingConfig = {
      config: [
        {
          reference: 'ordered-list',
          levels: [{ level: 0, format: 'decimal' as const, text: '%1.', alignment: AlignmentType.LEFT }],
        },
      ],
    };

    const document = new Document({
      numbering: numberingConfig,
      styles: {
        default: {
          document: { run: { font: 'Calibri', size: 22 } },
          heading1: {
            run: { size: 40, bold: true, font: 'Calibri' },
            paragraph: { spacing: { before: 240, after: 120 } },
          },
          heading2: {
            run: { size: 32, bold: true, font: 'Calibri' },
            paragraph: { spacing: { before: 200, after: 80 } },
          },
          heading3: {
            run: { size: 28, bold: true, font: 'Calibri' },
            paragraph: { spacing: { before: 160, after: 60 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: company, bold: true }),
                    new TextRun(' — '),
                    italic(control.confidentiality),
                  ],
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 0 },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${doc.title} | ${control.history[0] ? `v${control.history[0].version}` : 'Draft'} | `, size: 16 }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 16 }),
                    new TextRun({ text: ' / ', size: 16 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                }),
              ],
            }),
          },
          children: bodyElements,
        },
      ],
    });

    const buffer = await Packer.toBuffer(document);
    return { buffer: Buffer.from(buffer), filename: fileName(doc.title, doc.version, 'docx') };
  }
}
