import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { config } from '../config/env.config.ts';
import { buildHeaders } from '../helpers/headers.helper.ts';
import { searchPayload } from '../data/events/search.data.ts';
import { copyFormPayload } from '../data/events/copy-form.data.ts';
import { savePayload } from '../data/events/save.data.ts';
import { detailPayload } from '../data/events/detail.data.ts';
import { EventRow, SaveResult } from '../types/events.type.ts';

type Res = RefinedResponse<ResponseType | undefined>;

function parseEventRows(res: Res, name: string): EventRow[] {
  try {
    const body: any = res.json();
    const arr = Array.isArray(body) ? body : [];
    const tdt = arr.find((e) => e && typeof e === 'object' && !Array.isArray(e) && e.TransportDataTables);
    const table = tdt.TransportDataTables[0];
    const cols: string[] = table.TransportDataColumns.map((c: { ColumnName: string }) => c.ColumnName);
    const at = (v: Record<string, unknown>, n: string): string => String(v[String(cols.indexOf(n))]);
    return table.TransportDataRows.map((r: { Values: Record<string, unknown> }) => ({
      desc: at(r.Values, 'EV200_EVT_DESC'),
      evtId: at(r.Values, 'EV200_EVT_ID'),
      rowKey: at(r.Values, 'cROW_KEY'),
      acct: at(r.Values, 'EV200_CUST_NBR'),
      desig: at(r.Values, 'EV200_EVT_DESIGNATION'),
      status: at(r.Values, 'EV200_EVT_STATUS'),
      linkedFuncs: at(r.Values, 'EV200_LINKED_FUNCS'),
      orgCode: at(r.Values, 'EV200_ORG_CODE'),
    }));
  } catch (e) {
    console.error(`[VU ${__VU}] ${name}: failed to parse event rows — ${e}`);
    return [];
  }
}

export function searchEvents(
  token: string,
  version: string,
  searchValue: string,
  name = 'SearchEvents'
): EventRow[] {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/GetGridData2`,
    JSON.stringify(searchPayload(searchValue)),
    { headers: buildHeaders(token, version), tags: { name } }
  );

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] searchEvents failed — HTTP ${res.status}`);
    return [];
  }

  return parseEventRows(res, name);
}

export function openCopyForm(
  token: string,
  version: string,
  encUserId: string,
  source: EventRow
): Res | null {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(copyFormPayload(encUserId, source)),
    { headers: buildHeaders(token, version), tags: { name: 'OpenCopyForm' } }
  );

  const ok = check(res, {
    'OpenCopyForm: status is 201': (r) => r.status === 201,
    'OpenCopyForm: returns copy form data': (r) => String(r.body ?? '').length > 1000,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] openCopyForm failed — HTTP ${res.status}`);
    return null;
  }

  return res;
}

export function saveEventCopy(
  token: string,
  version: string,
  encUserId: string,
  source: EventRow,
  description: string
): string | null {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(savePayload(encUserId, source, description)),
    { headers: buildHeaders(token, version), tags: { name: 'SaveEventCopy' } }
  );

  const ok = check(res, {
    'SaveEventCopy: status is 201': (r) => r.status === 201,
    'SaveEventCopy: ResultValue is 0 (success)': (r) => {
      try { return (r.json() as unknown as SaveResult[])[0].ResultValue === 0; } catch { return false; }
    },
    'SaveEventCopy: returns new event row key': (r) => {
      try { const k = (r.json() as unknown as SaveResult[])[0].AddedRowKeys; return Array.isArray(k) && k.length > 0; } catch { return false; }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] saveEventCopy failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  const addedKey = (res.json() as unknown as SaveResult[])[0].AddedRowKeys[0];
  return addedKey.split('|')[1] || null;
}

export function openEventDetail(
  token: string,
  version: string,
  newEvtId: string,
  expectedDesc: string
): Res | null {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(detailPayload(newEvtId)),
    { headers: buildHeaders(token, version), tags: { name: 'OpenEventDetail' } }
  );

  const ok = check(res, {
    'OpenEventDetail: status is 201': (r) => r.status === 201,
    'OpenEventDetail: detail shows copied description': (r) => String(r.body ?? '').includes(expectedDesc),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] openEventDetail failed — HTTP ${res.status}`);
    return null;
  }

  return res;
}
