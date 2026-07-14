import { fail } from 'k6';
import { RefinedResponse, ResponseType } from 'k6/http';
import { JsonScalar, TransportEnvelope, TransportRow, TransportTable, TransportValues } from '../exports/types.exp.ts';

type Res = RefinedResponse<ResponseType | undefined>;

export function parse_grid_rows<M extends { [field: string]: string }>(
  res: Res,
  mapping: M,
  name: string,
  select_table: (tables: TransportTable[]) => TransportTable | undefined = (tables) => tables[0],
): { [field in keyof M]: string }[] {
  try {
    const body = res.json();
    const arr = Array.isArray(body) ? (body as TransportEnvelope[]) : [];
    const tdt = arr.find((e) => e && typeof e === 'object' && !Array.isArray(e) && e.TransportDataTables);
    const table = select_table(tdt!.TransportDataTables!)!;
    const cols: string[] = table.TransportDataColumns.map((c) => c.ColumnName);
    const at = (v: TransportValues, n: string) => {
      const i = cols.indexOf(n);
      const raw = i >= 0 ? v[String(i)] : '';
      return raw === null || raw === undefined ? '' : String(raw);
    };
    return table.TransportDataRows.map((r: TransportRow) => {
      const row = {} as { [field in keyof M]: string };
      for (const field of Object.keys(mapping) as (keyof M)[]) {
        row[field] = at(r.Values, mapping[field]);
      }
      return row;
    });
  } catch (e) {
    console.error(`[VU ${__VU}] ${name}: failed to parse grid rows — ${e}`);
    return [];
  }
}

export function initial_data_table(res: Res, name: string): TransportTable {
  const body = res.json();
  const arr = Array.isArray(body) ? (body as TransportEnvelope[]) : [];
  const envelope = arr.find((e) => e && typeof e === 'object' && !Array.isArray(e) && e.TransportDataTables);
  const table = envelope?.TransportDataTables?.[0];
  if (!table) {
    console.error(`[VU ${__VU}] ${name}: no transport table in GetInitialData2 response`);
    fail(`${name}: no transport table in response`);
  }
  return table;
}

export function find_transport_table(res: Res, columnName: string, name: string): TransportTable {
  const body = res.json();
  const arr = Array.isArray(body) ? (body as TransportEnvelope[]) : [];
  for (const el of arr) {
    if (!el || typeof el !== 'object' || Array.isArray(el) || !Array.isArray(el.TransportDataTables)) continue;
    for (const t of el.TransportDataTables) {
      if (t.TransportDataColumns.some((c) => c.ColumnName === columnName)) return t;
    }
  }
  console.error(`[VU ${__VU}] ${name}: no transport table with column ${columnName} in response`);
  fail(`${name}: table with column ${columnName} not found`);
}

export function set_cell(table: TransportTable, columnName: string, value: JsonScalar, name = 'set_cell') {
  const i = table.TransportDataColumns.findIndex((c) => c.ColumnName === columnName);
  if (i < 0) {
    console.error(`[VU ${__VU}] ${name}: column ${columnName} not in transport table`);
    fail(`${name}: column ${columnName} not found`);
  }
  table.TransportDataRows[0].Values[String(i)] = value;
}

export function get_cell(table: TransportTable, column: string | number) {
  const i = typeof column === 'number' ? column : table.TransportDataColumns.findIndex((c) => c.ColumnName === column);
  if (i < 0) return '';
  const v = table.TransportDataRows[0]?.Values[String(i)];
  return v === null || v === undefined ? '' : String(v);
}

const numericDataTypes = new Set(['System.Int32', 'System.Int64', 'System.Decimal', 'System.Double', 'System.DateTime']);

export function coerce_transport_types(table: TransportTable) {
  const cols = table.TransportDataColumns;
  for (const row of table.TransportDataRows) {
    for (let i = 0; i < cols.length; i++) {
      const key = String(i);
      const v = row.Values[key];
      if (typeof v !== 'string' || v === '') continue;
      if (numericDataTypes.has(cols[i].DataType ?? '') && !isNaN(Number(v))) {
        row.Values[key] = Number(v);
      }
    }
  }
  return table;
}
