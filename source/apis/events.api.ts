import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { searchPayload, copyFormPayload, savePayload, detailPayload, createEventPayload } from '../utils/exports/data.exp.ts';
import { EventRow, EventSaveResult, TransportEnvelope, TransportRow, TransportValues } from '../utils/exports/types.exp.ts';

type Res = RefinedResponse<ResponseType | undefined>;

function parse_event_rows(res: Res, name: string): EventRow[] {
  try {
    const body = res.json();
    const arr = Array.isArray(body) ? (body as TransportEnvelope[]) : [];
    const tdt = arr.find((e) => e && typeof e === 'object' && !Array.isArray(e) && e.TransportDataTables);
    const table = tdt!.TransportDataTables![0];
    const cols: string[] = table.TransportDataColumns.map((c) => c.ColumnName);
    const at = (v: TransportValues, n: string) => String(v[String(cols.indexOf(n))]);
    return table.TransportDataRows.map((r: TransportRow) => ({
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

export function search_events(token: string, version: string, searchValue: string, name = 'SearchEvents'): EventRow[] {
  const res = http.post(`${config.baseUrl}/api/USIDataGridServer/GetGridData2`, JSON.stringify(searchPayload(searchValue)), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] search_events failed — HTTP ${res.status}`);
    return [];
  }

  return parse_event_rows(res, name);
}

export function open_copy_form(token: string, version: string, encUserId: string, source: EventRow) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(copyFormPayload(encUserId, source, version)),
    { headers: build_headers(token, version), tags: { name: 'OpenCopyForm' } },
  );

  const ok = check(res, {
    'OpenCopyForm: status is 201': (r) => r.status === 201,
    'OpenCopyForm: returns copy form data': (r) => body_text(r).length > 1000,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_copy_form failed — HTTP ${res.status}`);
    fail('open_copy_form did not succeed');
  }
}

export function save_event_copy(token: string, version: string, encUserId: string, source: EventRow, description: string) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(savePayload(encUserId, source, description, version)),
    { headers: build_headers(token, version), tags: { name: 'SaveEventCopy' } },
  );

  const ok = check(res, {
    'SaveEventCopy: status is 201': (r) => r.status === 201,
    'SaveEventCopy: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as EventSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveEventCopy: returns new event row key': (r) => {
      try {
        const k = (r.json() as EventSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] save_event_copy failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('save_event_copy did not succeed');
  }

  const addedKey = (res.json() as EventSaveResult[])[0].AddedRowKeys[0];
  return addedKey.split('|')[1];
}

export function create_event(token: string, version: string, description: string, name = 'CreateEvent') {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(createEventPayload(description)), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: ResultValue is 0 (success)`]: (r) => {
      try {
        return (r.json() as EventSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    [`${name}: returns new event row key`]: (r) => {
      try {
        const k = (r.json() as EventSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] create_event failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('create_event did not succeed');
  }

  const addedKey = (res.json() as EventSaveResult[])[0].AddedRowKeys[0];
  return addedKey.split('|')[1];
}

export function open_event_detail(token: string, version: string, newEvtId: string, expectedDesc: string) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(detailPayload(newEvtId)), {
    headers: build_headers(token, version),
    tags: { name: 'OpenEventDetail' },
  });

  const ok = check(res, {
    'OpenEventDetail: status is 201': (r) => r.status === 201,
    'OpenEventDetail: detail shows copied description': (r) => body_text(r).includes(expectedDesc),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_event_detail failed — HTTP ${res.status}`);
    fail('open_event_detail did not succeed');
  }
}
