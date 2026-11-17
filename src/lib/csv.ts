// CSV building and download (browser). Every cell is quoted, and text that a spreadsheet
// would run as a formula is neutralised.

const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(',')).join('\r\n');

export function downloadCsv(filename: string, rows: unknown[][]) {
  // BOM so Excel reads UTF-8 (names with accents, “smart quotes”)
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}
