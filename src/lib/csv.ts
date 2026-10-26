function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  // 엑셀 수식 주입 방지
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** 엑셀에서 한글이 깨지지 않도록 BOM을 붙인 CSV */
export function toCSV(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(','));
  return '﻿' + lines.join('\r\n');
}
