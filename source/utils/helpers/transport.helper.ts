import { RefinedResponse, ResponseType } from 'k6/http';
import { TransportEnvelope, TransportRow, TransportTable, TransportValues } from '../exports/types.exp.ts';

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
