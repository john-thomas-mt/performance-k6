import { TransportTable } from '../exports/types.exp.ts';

export function todayMidnightUtc(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function setRowValue(table: TransportTable, columnName: string, value: unknown): void {
  const i = table.TransportDataColumns.findIndex((c) => c.ColumnName === columnName);
  if (i >= 0) table.TransportDataRows[0].Values[String(i)] = value;
}

export function setColumnValueAllRows(table: TransportTable, columnName: string, value: unknown): void {
  const i = table.TransportDataColumns.findIndex((c) => c.ColumnName === columnName);
  if (i < 0) return;
  for (const row of table.TransportDataRows) row.Values[String(i)] = value;
}

export function getColumnValue(table: TransportTable, row: number, columnName: string): unknown {
  const i = table.TransportDataColumns.findIndex((c) => c.ColumnName === columnName);
  return i >= 0 ? table.TransportDataRows[row]?.Values[String(i)] : undefined;
}
