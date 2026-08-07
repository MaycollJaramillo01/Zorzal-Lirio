export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/**
 * Caracteres con los que Excel y LibreOffice interpretan la celda como formula.
 * Texto escrito por el usuario (cliente, proyecto, notas) llega al CSV, asi que
 * se neutraliza anteponiendo un apostrofe. Los numeros los genera el sistema y
 * se dejan intactos para que sigan siendo numeros en la hoja de calculo.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function neutralizeFormula(text: string): string {
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

function escapeCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const text = typeof raw === 'number' ? String(raw) : neutralizeFormula(String(raw));
  if (/[";\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Excel en espanol necesita el BOM para reconocer el archivo como UTF-8. */
export const UTF8_BOM = '\uFEFF';

/**
 * CSV con separador `;` y BOM UTF-8: es lo que Excel en espanol abre sin pasos
 * extra de importacion.
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCell(column.header)).join(';');
  const body = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(';'));
  return `${UTF8_BOM}${[header, ...body].join('\r\n')}\r\n`;
}

export function csvFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}-${stamp}.csv`;
}
