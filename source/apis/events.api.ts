import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import {
  build_headers,
  body_text,
  parse_grid_rows,
  initial_data_table,
  find_transport_table,
  get_cell,
} from '../utils/exports/helpers.exp.ts';
import {
  searchPayload,
  copyFormPayload,
  savePayload,
  detailPayload,
  eventCreateFormPayload,
  eventSavePayload,
  eventDocumentFormPayload,
  eventDocumentSavePayload,
  eventControlInfoPayload,
} from '../utils/exports/data.exp.ts';
import {
  EventRow,
  EventSaveResult,
  EventDetailContext,
  EventDocumentContext,
  EventDocumentFields,
  TransportTable,
} from '../utils/exports/types.exp.ts';

export function get_event_control_info(token: string, version: string, row: EventRow, name = 'GetControlInfo') {
  const res = http.post(`${config.baseUrl}/api/USIDataGridServer/GetControlInfo`, JSON.stringify(eventControlInfoPayload(row)), {
    headers: build_headers(token, version),
    tags: { name },
  });

  check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });
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

  return parse_grid_rows(
    res,
    {
      desc: 'EV200_EVT_DESC',
      evtId: 'EV200_EVT_ID',
      rowKey: 'cROW_KEY',
      acct: 'EV200_CUST_NBR',
      desig: 'EV200_EVT_DESIGNATION',
      status: 'EV200_EVT_STATUS',
      linkedFuncs: 'EV200_LINKED_FUNCS',
      orgCode: 'EV200_ORG_CODE',
      acctName: 'EventAccount_EV870_NAME',
      acctClass: 'EventAccount_EV870_CLASS',
      evtType: 'EV200_EVT_TYPE',
      cEvtType: 'cEVT_TYPE',
      cEvtTypeSort: 'cEVT_TYPE__SORT',
      purgeInd: 'EV200_PURGE_IND',
      plnAttend: 'EV200_PLN_ATTEND',
      parentEvtId: 'cPARENT_EVT_ID',
      evtStartDate: 'EV200_EVT_START_DATE',
      evtStartTime: 'EV200_EVT_START_TIME',
      evtEndDate: 'EV200_EVT_END_DATE',
      evtEndTime: 'EV200_EVT_END_TIME',
      evtInDate: 'EV200_EVT_IN_DATE',
      evtInTime: 'EV200_EVT_IN_TIME',
    },
    name,
  );
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

export function open_event_create_form(token: string, version: string, name = 'OpenEventCreateForm'): TransportTable {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(eventCreateFormPayload()), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_event_create_form failed — HTTP ${res.status}`);
    fail('open_event_create_form did not succeed');
  }

  return initial_data_table(res, name);
}

export function create_event(token: string, version: string, table: TransportTable, description: string, name = 'CreateEvent') {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(eventSavePayload(table, description)), {
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

export function open_event_detail(token: string, version: string, evtId: string, expectedContent = evtId): EventDetailContext {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(detailPayload(evtId)), {
    headers: build_headers(token, version),
    tags: { name: 'OpenEventDetail' },
  });

  const ok = check(res, {
    'OpenEventDetail: status is 201': (r) => r.status === 201,
    'OpenEventDetail: returns event detail data': (r) => body_text(r).includes(expectedContent),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_event_detail failed — HTTP ${res.status}`);
    fail('open_event_detail did not succeed');
  }

  const table = initial_data_table(res, 'OpenEventDetail');
  return {
    evtCntct: get_cell(table, 'EV200_NG_EVT_CONTACT'),
    evtSalesPer: get_cell(table, 'EV200_SLSPER'),
    evtCategory: get_cell(table, 'EV200_EVT_CATEGORY'),
    evtPriceList: get_cell(table, 'EV200_PRICE_LIST'),
    coord1: get_cell(table, 'EV200_COORD_1'),
    coord2: get_cell(table, 'EV200_COORD_2'),
  };
}

export function open_event_document_form(
  token: string,
  version: string,
  ctx: EventDocumentContext,
  fileKey: string,
  fileName: string,
  wdwid: string,
): EventDocumentFields {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(eventDocumentFormPayload(ctx, fileKey, fileName, wdwid)),
    { headers: build_headers(token, version), tags: { name: 'OpenEventDocumentForm' } },
  );

  const ok = check(res, {
    'OpenEventDocumentForm: status is 201': (r) => r.status === 201,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] open_event_document_form failed — HTTP ${res.status}`);
    fail('open_event_document_form did not succeed');
  }

  const table = find_transport_table(res, 'MM446_DOC_DESC', 'OpenEventDocumentForm');
  return {
    fileKey,
    fileName,
    docDesc: get_cell(table, 'MM446_DOC_DESC'),
    evtDesc: get_cell(table, 'docEvents_EV200_EVT_DESC'),
    acctName: get_cell(table, 'DocAccount_EV870_NAME'),
  };
}

export function save_event_document(token: string, version: string, ctx: EventDocumentContext, doc: EventDocumentFields, wdwid: string) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(eventDocumentSavePayload(ctx, doc, wdwid)), {
    headers: build_headers(token, version),
    tags: { name: 'SaveEventDocument' },
  });

  const ok = check(res, {
    'SaveEventDocument: status is 201': (r) => r.status === 201,
    'SaveEventDocument: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as EventSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveEventDocument: document row was added': (r) => {
      try {
        const k = (r.json() as EventSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] save_event_document failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('save_event_document did not succeed');
  }
}
