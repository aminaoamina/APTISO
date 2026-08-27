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
  type IParagraphOptions,
  type ITableOptions,
  type ITableCellOptions,
  type INumberingOptions,
} from 'docx';

// ─── ProseMirror types (subset we need) ─────────────────────────
interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: PMMark[];
  text?: string;
}

// ─── Constants matching the reference .docx ──────────────────────
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000', space: 0 };
const TABLE_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

const HEADING_STYLES = {
  1: { heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 60 } },
  2: { heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 60 } },
  3: { heading: HeadingLevel.HEADING_3, spacing: { before: 160, after: 40 } },
};

// ─── Conversion ──────────────────────────────────────────────────

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

function convertParagraph(node: PMNode): Paragraph {
  const runs = buildRuns(node);
  const level = node.type === 'heading' ? (node.attrs?.level as number | undefined) : undefined;

  const opts: Record<string, unknown> = {
    children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
  };

  if (level && HEADING_STYLES[level as keyof typeof HEADING_STYLES]) {
    const hs = HEADING_STYLES[level as keyof typeof HEADING_STYLES];
    opts.heading = hs.heading;
    opts.spacing = hs.spacing;
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

  const cellOpts: ITableCellOptions = {
    children: [
      new Paragraph({
        children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
      }),
    ],
    borders: {
      top: BORDER,
      bottom: BORDER,
      left: BORDER,
      right: BORDER,
    },
  };

  return new TableCell(cellOpts);
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

  const tableOpts: ITableOptions = {
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
  };

  return new Table(tableOpts);
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
        const paras = extractListText(item);
        return paras.map(
          (t) =>
            new Paragraph({
              children: [new TextRun(t)],
              bullet: { level: 0 },
            }),
        );
      });

    case 'orderedList':
      return (node.content ?? []).flatMap((item) => {
        const paras = extractListText(item);
        return paras.map(
          (t) =>
            new Paragraph({
              children: [new TextRun(t)],
              numbering: { reference: 'ordered-list', level: 0 },
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

// ─── Public API ──────────────────────────────────────────────────

export async function exportToDocx(
  content: PMNode,
  filename: string = 'document.docx',
): Promise<void> {
  const elements = convertNode(content);

  const numberingConfig: INumberingOptions = {
    config: [
      {
        reference: 'ordered-list',
        levels: [
          {
            level: 0,
            format: 'decimal',
            text: '%1.',
            alignment: AlignmentType.LEFT,
          },
        ],
      },
    ],
  };

  const doc = new Document({
    numbering: numberingConfig,
    styles: {
      default: {
        heading1: {
          run: { size: 40, bold: true },
          paragraph: { spacing: { before: 200, after: 60 } },
        },
        heading2: {
          run: { size: 32, bold: true },
          paragraph: { spacing: { before: 180, after: 60 } },
        },
        heading3: {
          run: { size: 28, bold: true },
          paragraph: { spacing: { before: 160, after: 40 } },
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
        children: elements,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : filename + '.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
