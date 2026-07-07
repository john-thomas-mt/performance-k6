import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check, fail } from 'k6';
import { b64encode } from 'k6/encoding';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, parse_grid_rows } from '../utils/exports/helpers.exp.ts';
import {
  serviceOrdersGridPayload,
  serviceOrderDetailPayload,
  serviceOrderItemsSavePayload,
  createServiceOrderPayload,
  editGeneralSavePayload,
  cacheFilesPayload,
  documentFormPayload,
  documentSavePayload,
} from '../utils/exports/data.exp.ts';
import { EventRow, ServiceOrderRow, ServiceOrderSaveResult, DocumentFields, TransportEnvelope } from '../utils/exports/types.exp.ts';

type Res = RefinedResponse<ResponseType | undefined>;

export function load_service_orders(token: string, version: string, event: EventRow, name = 'LoadServiceOrders'): ServiceOrderRow[] {
  const res = http.post(`${config.baseUrl}/api/USIDataGridServer/GetInitialData2`, JSON.stringify(serviceOrdersGridPayload(event)), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] load_service_orders failed — HTTP ${res.status}`);
    return [];
  }

  return parse_grid_rows(
    res,
    {
      orderNbr: 'ER100_ORD_NBR',
      soSearch: 'ER100_SO_SEARCH',
      rowKey: 'cROW_KEY',
      orgCode: 'ER100_ORG_CODE',
      ordAcct: 'ER100_ORD_ACCT',
      billTo: 'ER100_BILL_TO_CUST',
      evtId: 'ER100_EVT_ID',
      funcId: 'ER100_FUNC_ID',
      btoContact: 'ER100_NG_BTO_CONTACT',
      ordContact: 'ER100_NG_ORD_CONTACT',
      reqContact: 'ER100_NG_REQ_CONTACT',
      salesPer: 'ER100_ORD_ACCT_REP',
      orderType: 'ER100_ORD_TYPE',
      priceList: 'ER100_PRICE_LIST',
      reqCust: 'ER100_REQ_CUST',
      resPhase: 'ER100_RES_PHASE',
      shipTo: 'ER100_SHIPTO_ACCT',
      shipToContact: 'ER100_SHIPTO_CONT',
      evtDesig: 'OrderEvent_EV200_EVT_DESIGNATION',
      acctClass: 'OrderAccount_EV870_CLASS',
      evtStatus: 'OrderEvent_EV200_EVT_STATUS',
      status: 'ER100_NEW_STS',
      invoice: 'ER100_INVOICE',
      exhibitorId: 'ER100_EXHIBITOR_ID',
      occurrence: 'ER100_OCCURRENCE',
      eventSuiteId: 'ER100_EVENT_SUITE_ID',
      ordCatSeq: 'ER100_ORD_CAT_SEQ',
    },
    name,
    (tables) => tables.find((t) => t.TransportDataColumns.some((c) => c.ColumnName === 'ER100_ORD_NBR')),
  );
}

export function open_service_order_detail(token: string, version: string, so: ServiceOrderRow) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(serviceOrderDetailPayload(so)), {
    headers: build_headers(token, version),
    tags: { name: 'OpenServiceOrderDetail' },
  });

  const ok = check(res, {
    'OpenServiceOrderDetail: status is 201': (r) => r.status === 201,
    'OpenServiceOrderDetail: returns order detail data': (r) => body_text(r).includes(so.orderNbr),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_service_order_detail failed — HTTP ${res.status}`);
    fail('open_service_order_detail did not succeed');
  }

  return res;
}

export function create_service_order(token: string, version: string, encUserId: string, evtId: string, name = 'CreateServiceOrder') {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(createServiceOrderPayload(encUserId, evtId, version)),
    { headers: build_headers(token, version), tags: { name } },
  );

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: ResultValue is 0 (success)`]: (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    [`${name}: returns new order row key`]: (r) => {
      try {
        const k = (r.json() as ServiceOrderSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] create_service_order failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('create_service_order did not succeed');
  }

  const addedKey = (res.json() as ServiceOrderSaveResult[])[0].AddedRowKeys![0];
  return addedKey.split('|')[1];
}

export function read_order_header_stamps(res: Res) {
  try {
    const body = res.json();
    const arr = Array.isArray(body) ? (body as TransportEnvelope[]) : [];
    for (const el of arr) {
      const tables = el && typeof el === 'object' && !Array.isArray(el) && el.TransportDataTables;
      if (!Array.isArray(tables)) continue;
      for (const t of tables) {
        const cols: string[] = (t.TransportDataColumns || []).map((c) => c.ColumnName);
        const ui = cols.indexOf('ER100_UPD_DATE_ISO');
        const ei = cols.indexOf('ER100_ENT_DATE_ISO');
        if (ui >= 0 && t.TransportDataRows?.[0]) {
          const v = t.TransportDataRows[0].Values;
          return { entDateIso: String(v[String(ei)]), updDateIso: String(v[String(ui)]) };
        }
      }
    }
  } catch (e) {
    console.error(`[VU ${__VU}] read_order_header_stamps failed — ${e}`);
  }
  check(null, { 'ReadOrderHeaderStamps: header stamps present': () => false });
  fail('read_order_header_stamps: header stamps not found in detail response');
}

export function edit_service_order_general(
  token: string,
  version: string,
  so: ServiceOrderRow,
  orderDate: number,
  stamps: { entDateIso: string; updDateIso: string },
) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(editGeneralSavePayload(so, orderDate, stamps)), {
    headers: build_headers(token, version),
    tags: { name: 'EditServiceOrderGeneral' },
  });

  const ok = check(res, {
    'EditServiceOrderGeneral: status is 201': (r) => r.status === 201,
    'EditServiceOrderGeneral: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'EditServiceOrderGeneral: order row was modified': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ModifiedRowKeys?.includes(so.rowKey) ?? false;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] edit_service_order_general failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('edit_service_order_general did not succeed');
  }
}

export function cache_document_file(token: string, version: string, fileName: string, fileContent: ArrayBuffer) {
  const res = http.post(
    `${config.baseUrl}/api/GenericServer/CacheFiles`,
    JSON.stringify(cacheFilesPayload(fileName, b64encode(fileContent))),
    { headers: build_headers(token, version), tags: { name: 'CacheFiles' } },
  );

  const ok = check(res, {
    'CacheFiles: status is 201': (r) => r.status === 201,
    'CacheFiles: returns a cached file ref': (r) => {
      try {
        return typeof (r.json() as string[][])[0][0] === 'string';
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] cache_document_file failed — HTTP ${res.status}: ${body_text(res).slice(0, 200)}`);
    fail('cache_document_file did not succeed');
  }

  return (res.json() as string[][])[0][0];
}

export function open_document_form(token: string, version: string, so: ServiceOrderRow, fileKey: string, fileName: string) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(documentFormPayload(so, fileKey, fileName)),
    { headers: build_headers(token, version), tags: { name: 'OpenDocumentForm' } },
  );

  const ok = check(res, {
    'OpenDocumentForm: status is 201': (r) => r.status === 201,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] open_document_form failed — HTTP ${res.status}`);
    fail('open_document_form did not succeed');
  }

  try {
    const body = res.json();
    const arr = Array.isArray(body) ? (body as TransportEnvelope[]) : [];
    for (const el of arr) {
      const tables = el && typeof el === 'object' && !Array.isArray(el) && el.TransportDataTables;
      if (!Array.isArray(tables)) continue;
      for (const t of tables) {
        const cols: string[] = (t.TransportDataColumns || []).map((c) => c.ColumnName);
        const di = cols.indexOf('MM446_DOC_DESC');
        if (di >= 0 && t.TransportDataRows?.[0]) {
          const v = t.TransportDataRows[0].Values;
          const at = (n: string) => String(v[String(cols.indexOf(n))] ?? '');
          return { fileKey: at('cFILE_KEY'), fileName: at('cDOC_FILE_NAME'), docDesc: at('MM446_DOC_DESC') };
        }
      }
    }
  } catch (e) {
    console.error(`[VU ${__VU}] open_document_form parse failed — ${e}`);
  }
  check(null, { 'OpenDocumentForm: document fields present': () => false });
  fail('open_document_form: document fields not found in form response');
}

export function save_document(token: string, version: string, so: ServiceOrderRow, doc: DocumentFields) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(documentSavePayload(so, doc)), {
    headers: build_headers(token, version),
    tags: { name: 'SaveDocument' },
  });

  const ok = check(res, {
    'SaveDocument: status is 201': (r) => r.status === 201,
    'SaveDocument: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveDocument: document row was added': (r) => {
      try {
        const k = (r.json() as ServiceOrderSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] save_document failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('save_document did not succeed');
  }
}

export function save_and_close_service_order(
  token: string,
  version: string,
  so: ServiceOrderRow,
  orderDate: number,
  stamps: { entDateIso: string; updDateIso: string },
) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(editGeneralSavePayload(so, orderDate, stamps, 0)),
    { headers: build_headers(token, version), tags: { name: 'SaveAndCloseServiceOrder' } },
  );

  const ok = check(res, {
    'SaveAndCloseServiceOrder: status is 201': (r) => r.status === 201,
    'SaveAndCloseServiceOrder: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveAndCloseServiceOrder: order row was modified': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ModifiedRowKeys?.includes(so.rowKey) ?? false;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] save_and_close_service_order failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('save_and_close_service_order did not succeed');
  }
}

export function save_service_order_items(token: string, version: string, so: ServiceOrderRow, quantity: number) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(serviceOrderItemsSavePayload(so, quantity)), {
    headers: build_headers(token, version),
    tags: { name: 'SaveServiceOrderItems' },
  });

  const addedItemCount = (r: Res) => {
    try {
      const map = (r.json() as ServiceOrderSaveResult[])[0].AdditionalTableNameAddedRowKeys ?? {};
      return Object.keys(map).reduce((sum, k) => sum + (map[k]?.length ?? 0), 0);
    } catch {
      return 0;
    }
  };

  const ok = check(res, {
    'SaveServiceOrderItems: status is 201': (r) => r.status === 201,
    'SaveServiceOrderItems: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveServiceOrderItems: order row was modified': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ModifiedRowKeys?.includes(so.rowKey) ?? false;
      } catch {
        return false;
      }
    },
    'SaveServiceOrderItems: items were added to order': (r) => addedItemCount(r) > 0,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] save_service_order_items failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('save_service_order_items did not succeed');
  }
}
