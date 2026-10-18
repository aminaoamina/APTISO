import ExcelJS from 'exceljs';

export type CellValue = string | number | boolean | Date | null | undefined;

export interface Column { header: string; width?: number }

/** One worksheet: a register as a table. */
export interface Sheet {
  name: string;
  columns: Column[];
  rows: CellValue[][];
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
const DATE_FORMAT = 'dd/mm/yyyy';

/**
 * Builds a workbook where every sheet reads as a register: bold header,
 * frozen first row, a filter on every column, real dates and wrapped text.
 */
export async function buildWorkbook(sheets: Sheet[], creator: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = creator;
  workbook.created = new Date();
  for (const sheet of sheets) {
    // Excel sheet names: max 31 characters, no []:*?/\
    const ws = workbook.addWorksheet(sheet.name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = sheet.columns.map(c => ({ header: c.header, width: c.width ?? 18 }));
    for (const row of sheet.rows) ws.addRow(row.map(v => (v === undefined ? null : v)));

    const header = ws.getRow(1);
    header.font = { bold: true };
    header.fill = HEADER_FILL;
    header.alignment = { vertical: 'middle', wrapText: true };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
    ws.eachRow((row, n) => {
      if (n === 1) return;
      row.alignment = { vertical: 'top', wrapText: true };
      row.eachCell(cell => { if (cell.value instanceof Date) cell.numFmt = DATE_FORMAT; });
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
