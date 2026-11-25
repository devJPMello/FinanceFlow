import { parse as parseCsvLib } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import { ImportMapping } from '@financeflow/shared';

export interface RawTable {
  columns: string[];
  rows: Record<string, string>[];
}

export interface NormalizedRow {
  date: string | null; // YYYY-MM-DD
  description: string;
  amount: number | null; // positivo; tipo definido separadamente
  type: 'INCOME' | 'EXPENSE' | null;
  externalId?: string;
  error?: string;
}

// ---------- leitura dos arquivos ----------

export function decodeText(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  return utf8.includes('�') ? buf.toString('latin1') : utf8.replace(/^﻿/, '');
}

export function detectDelimiter(headerLine: string): string {
  const candidates = [';', ',', '\t', '|'];
  return candidates
    .map((d) => ({ d, n: headerLine.split(d).length }))
    .sort((a, b) => b.n - a.n)[0].d;
}

export function parseCsv(buf: Buffer): RawTable {
  const text = decodeText(buf);
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const records: Record<string, string>[] = parseCsvLib(text, {
    columns: (h: string[]) => h.map((c) => c.trim()),
    delimiter: detectDelimiter(firstLine),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
  const columns = records.length ? Object.keys(records[0]) : firstLine.split(detectDelimiter(firstLine));
  return { columns, rows: records };
}

function cellToString(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join('');
    if (o.result != null) return cellToString(o.result);
    if (o.text != null) return String(o.text);
  }
  return String(v);
}

export async function parseXlsx(buf: Buffer): Promise<RawTable> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { columns: [], rows: [] };
  const columns: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    columns[col - 1] = cellToString(cell.value).trim() || `Coluna ${col}`;
  });
  const rows: Record<string, string>[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const rec: Record<string, string> = {};
    let any = false;
    columns.forEach((c, i) => {
      const v = cellToString(row.getCell(i + 1).value).trim();
      if (v) any = true;
      rec[c] = v;
    });
    if (any) rows.push(rec);
  });
  return { columns: columns.filter(Boolean), rows };
}

export const OFX_COLUMNS = ['date', 'description', 'amount', 'fitid'];

export function parseOfx(buf: Buffer): RawTable {
  const text = decodeText(buf);
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, name: string) => {
    const m = b.match(new RegExp('<' + name + '>([^<\\r\\n]*)', 'i'));
    return m ? m[1].trim() : '';
  };
  const rows = blocks.map((b) => {
    const dt = tag(b, 'DTPOSTED');
    return {
      date: dt.length >= 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : '',
      description: tag(b, 'MEMO') || tag(b, 'NAME'),
      amount: tag(b, 'TRNAMT').replace(',', '.'),
      fitid: tag(b, 'FITID'),
    };
  });
  return { columns: OFX_COLUMNS, rows };
}

export const OFX_MAPPING: ImportMapping = {
  date: 'date', description: 'description', amount: 'amount', dateFormat: 'YYYY-MM-DD', decimal: '.',
};

// ---------- normalização ----------

export function parseDate(value: string, format: ImportMapping['dateFormat']): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  let y: number, m: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  } else {
    const parts = v.split(/[\/.\-\s]/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    if (format === 'MM/DD/YYYY') [m, d, y] = parts;
    else if (format === 'YYYY-MM-DD') [y, m, d] = parts;
    else [d, m, y] = parts;
    if (y < 100) y += 2000;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseAmount(value: string, decimal: ',' | '.'): number | null {
  let v = (value ?? '').trim();
  if (!v) return null;
  let negative = false;
  if (/^\(.*\)$/.test(v)) { negative = true; v = v.slice(1, -1); }
  if (v.includes('-')) negative = true;
  v = v.replace(/[^0-9.,]/g, '');
  if (decimal === ',') v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  const n = Number(v);
  if (!v || Number.isNaN(n)) return null;
  return negative ? -n : n;
}

export function normalizeRows(table: RawTable, mapping: ImportMapping): NormalizedRow[] {
  return table.rows.map((r) => {
    const date = parseDate(r[mapping.date], mapping.dateFormat);
    const description = (r[mapping.description] ?? '').trim();
    let signed: number | null = null;
    if (mapping.amount) {
      signed = parseAmount(r[mapping.amount], mapping.decimal);
      if (signed != null && mapping.invertSign) signed = -signed;
    } else {
      const credit = mapping.credit ? parseAmount(r[mapping.credit], mapping.decimal) : null;
      const debit = mapping.debit ? parseAmount(r[mapping.debit], mapping.decimal) : null;
      if (credit) signed = Math.abs(credit);
      else if (debit) signed = -Math.abs(debit);
    }
    const externalId = r['fitid'] || undefined;
    const row: NormalizedRow = {
      date, description, externalId,
      amount: signed == null ? null : Math.abs(signed),
      type: signed == null || signed === 0 ? null : signed > 0 ? 'INCOME' : 'EXPENSE',
    };
    if (!date) row.error = 'Data inválida';
    else if (!description) row.error = 'Descrição vazia';
    else if (signed == null || signed === 0) row.error = 'Valor inválido';
    return row;
  });
}
