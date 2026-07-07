import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { b64encode } from 'k6/encoding';
import { config } from '../utils/exports/config.exp.ts';
import { buildHeaders } from '../utils/exports/helpers.exp.ts';
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
import { EventRow, ServiceOrderRow, ServiceOrderSaveResult, DocumentFields } from '../utils/exports/types.exp.ts';

type Res = RefinedResponse<ResponseType | undefined>;

function parseServiceOrderRows(res: Res, name: string): ServiceOrderRow[] {
  try {
    const body: any = res.json();
    const arr = Array.isArray(body) ? body : [];
    const tdt = arr.find((e) => e && typeof e === 'object' && !Array.isArray(e) && e.TransportDataTables);
    const table = tdt.TransportDataTables.find((t: any) =>
      t.TransportDataColumns.some((c: { ColumnName: string }) => c.ColumnName === 'ER100_ORD_NBR'),
    );
    const cols: string[] = table.TransportDataColumns.map((c: { ColumnName: string }) => c.ColumnName);
    const at = (v: Record<string, unknown>, n: string) => {
      const i = cols.indexOf(n);
      const raw = i >= 0 ? v[String(i)] : '';
      return raw === null || raw === undefined ? '' : String(raw);
    };
    return table.TransportDataRows.map((r: { Values: Record<string, unknown> }) => ({
      orderNbr: at(r.Values, 'ER100_ORD_NBR'),
      soSearch: at(r.Values, 'ER100_SO_SEARCH'),
      rowKey: at(r.Values, 'cROW_KEY'),
      orgCode: at(r.Values, 'ER100_ORG_CODE'),
      ordAcct: at(r.Values, 'ER100_ORD_ACCT'),
      billTo: at(r.Values, 'ER100_BILL_TO_CUST'),
      evtId: at(r.Values, 'ER100_EVT_ID'),
      funcId: at(r.Values, 'ER100_FUNC_ID'),
      btoContact: at(r.Values, 'ER100_NG_BTO_CONTACT'),
      ordContact: at(r.Values, 'ER100_NG_ORD_CONTACT'),
      reqContact: at(r.Values, 'ER100_NG_REQ_CONTACT'),
      salesPer: at(r.Values, 'ER100_ORD_ACCT_REP'),
      orderType: at(r.Values, 'ER100_ORD_TYPE'),
      priceList: at(r.Values, 'ER100_PRICE_LIST'),
      reqCust: at(r.Values, 'ER100_REQ_CUST'),
      resPhase: at(r.Values, 'ER100_RES_PHASE'),
      shipTo: at(r.Values, 'ER100_SHIPTO_ACCT'),
      shipToContact: at(r.Values, 'ER100_SHIPTO_CONT'),
      evtDesig: at(r.Values, 'OrderEvent_EV200_EVT_DESIGNATION'),
      acctClass: at(r.Values, 'OrderAccount_EV870_CLASS'),
      evtStatus: at(r.Values, 'OrderEvent_EV200_EVT_STATUS'),
      status: at(r.Values, 'ER100_NEW_STS'),
      invoice: at(r.Values, 'ER100_INVOICE'),
      exhibitorId: at(r.Values, 'ER100_EXHIBITOR_ID'),
      occurrence: at(r.Values, 'ER100_OCCURRENCE'),
      eventSuiteId: at(r.Values, 'ER100_EVENT_SUITE_ID'),
      ordCatSeq: at(r.Values, 'ER100_ORD_CAT_SEQ'),
    }));
  } catch (e) {
    console.error(`[VU ${__VU}] ${name}: failed to parse service order rows — ${e}`);
    return [];
  }
}

export function loadServiceOrders(token: string, version: string, event: EventRow, name = 'LoadServiceOrders'): ServiceOrderRow[] {
  const res = http.post(`${config.baseUrl}/api/USIDataGridServer/GetInitialData2`, JSON.stringify(serviceOrdersGridPayload(event)), {
    headers: buildHeaders(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] loadServiceOrders failed — HTTP ${res.status}`);
    return [];
  }

  return parseServiceOrderRows(res, name);
}

export function openServiceOrderDetail(token: string, version: string, so: ServiceOrderRow) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(serviceOrderDetailPayload(so)), {
    headers: buildHeaders(token, version),
    tags: { name: 'OpenServiceOrderDetail' },
  });

  const ok = check(res, {
    'OpenServiceOrderDetail: status is 201': (r) => r.status === 201,
    'OpenServiceOrderDetail: returns order detail data': (r) => String(r.body ?? '').includes(so.orderNbr),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] openServiceOrderDetail failed — HTTP ${res.status}`);
    return null;
  }

  return res;
}

export function createServiceOrder(token: string, version: string, encUserId: string, evtId: string, name = 'CreateServiceOrder') {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(createServiceOrderPayload(encUserId, evtId, version)),
    { headers: buildHeaders(token, version), tags: { name } },
  );

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: ResultValue is 0 (success)`]: (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    [`${name}: returns new order row key`]: (r) => {
      try {
        const k = (r.json() as unknown as ServiceOrderSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] createServiceOrder failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  const addedKey = (res.json() as unknown as ServiceOrderSaveResult[])[0].AddedRowKeys?.[0];
  return addedKey ? addedKey.split('|')[1] || null : null;
}

export function readOrderHeaderStamps(res: Res) {
  try {
    const body: any = res.json();
    const arr = Array.isArray(body) ? body : [];
    for (const el of arr) {
      const tables = el && typeof el === 'object' && !Array.isArray(el) && el.TransportDataTables;
      if (!Array.isArray(tables)) continue;
      for (const t of tables) {
        const cols: string[] = (t.TransportDataColumns || []).map((c: { ColumnName: string }) => c.ColumnName);
        const ui = cols.indexOf('ER100_UPD_DATE_ISO');
        const ei = cols.indexOf('ER100_ENT_DATE_ISO');
        if (ui >= 0 && t.TransportDataRows?.[0]) {
          const v = t.TransportDataRows[0].Values;
          return { entDateIso: String(v[String(ei)]), updDateIso: String(v[String(ui)]) };
        }
      }
    }
  } catch (e) {
    console.error(`[VU ${__VU}] readOrderHeaderStamps failed — ${e}`);
  }
  return null;
}

export function editServiceOrderGeneral(
  token: string,
  version: string,
  so: ServiceOrderRow,
  orderDate: number,
  stamps: { entDateIso: string; updDateIso: string },
) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(editGeneralSavePayload(so, orderDate, stamps)), {
    headers: buildHeaders(token, version),
    tags: { name: 'EditServiceOrderGeneral' },
  });

  const ok = check(res, {
    'EditServiceOrderGeneral: status is 201': (r) => r.status === 201,
    'EditServiceOrderGeneral: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'EditServiceOrderGeneral: order row was modified': (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ModifiedRowKeys?.includes(so.rowKey) ?? false;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] editServiceOrderGeneral failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  return (res.json() as unknown as ServiceOrderSaveResult[])[0];
}

export function cacheDocumentFile(token: string, version: string, fileName: string, fileContent: ArrayBuffer) {
  const res = http.post(
    `${config.baseUrl}/api/GenericServer/CacheFiles`,
    JSON.stringify(cacheFilesPayload(fileName, b64encode(fileContent))),
    { headers: buildHeaders(token, version), tags: { name: 'CacheFiles' } },
  );

  const ok = check(res, {
    'CacheFiles: status is 201': (r) => r.status === 201,
    'CacheFiles: returns a cached file ref': (r) => {
      try {
        return typeof (r.json() as unknown as string[][])[0][0] === 'string';
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] cacheDocumentFile failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 200)}`);
    return null;
  }

  return (res.json() as unknown as string[][])[0][0];
}

export function openDocumentForm(token: string, version: string, so: ServiceOrderRow, fileKey: string, fileName: string) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(documentFormPayload(so, fileKey, fileName)),
    { headers: buildHeaders(token, version), tags: { name: 'OpenDocumentForm' } },
  );

  const ok = check(res, {
    'OpenDocumentForm: status is 201': (r) => r.status === 201,
  });
  if (!ok) {
    console.error(`[VU ${__VU}] openDocumentForm failed — HTTP ${res.status}`);
    return null;
  }

  // The document detail response carries the server-allocated file key plus the generated
  // description and filename — correlate all three for the import Save2.
  try {
    const body: any = res.json();
    const arr = Array.isArray(body) ? body : [];
    for (const el of arr) {
      const tables = el && typeof el === 'object' && !Array.isArray(el) && el.TransportDataTables;
      if (!Array.isArray(tables)) continue;
      for (const t of tables) {
        const cols: string[] = (t.TransportDataColumns || []).map((c: { ColumnName: string }) => c.ColumnName);
        const di = cols.indexOf('MM446_DOC_DESC');
        if (di >= 0 && t.TransportDataRows?.[0]) {
          const v = t.TransportDataRows[0].Values;
          const at = (n: string) => String(v[String(cols.indexOf(n))] ?? '');
          return { fileKey: at('cFILE_KEY'), fileName: at('cDOC_FILE_NAME'), docDesc: at('MM446_DOC_DESC') };
        }
      }
    }
  } catch (e) {
    console.error(`[VU ${__VU}] openDocumentForm parse failed — ${e}`);
  }
  return null;
}

export function saveDocument(token: string, version: string, so: ServiceOrderRow, doc: DocumentFields) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(documentSavePayload(so, doc)), {
    headers: buildHeaders(token, version),
    tags: { name: 'SaveDocument' },
  });

  const ok = check(res, {
    'SaveDocument: status is 201': (r) => r.status === 201,
    'SaveDocument: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveDocument: document row was added': (r) => {
      try {
        const k = (r.json() as unknown as ServiceOrderSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] saveDocument failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  return (res.json() as unknown as ServiceOrderSaveResult[])[0];
}

export function saveAndCloseServiceOrder(
  token: string,
  version: string,
  so: ServiceOrderRow,
  orderDate: number,
  stamps: { entDateIso: string; updDateIso: string },
) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(editGeneralSavePayload(so, orderDate, stamps, 0)),
    { headers: buildHeaders(token, version), tags: { name: 'SaveAndCloseServiceOrder' } },
  );

  const ok = check(res, {
    'SaveAndCloseServiceOrder: status is 201': (r) => r.status === 201,
    'SaveAndCloseServiceOrder: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveAndCloseServiceOrder: order row was modified': (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ModifiedRowKeys?.includes(so.rowKey) ?? false;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] saveAndCloseServiceOrder failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  return (res.json() as unknown as ServiceOrderSaveResult[])[0];
}

export function saveServiceOrderItems(token: string, version: string, so: ServiceOrderRow, quantity: number) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(serviceOrderItemsSavePayload(so, quantity)), {
    headers: buildHeaders(token, version),
    tags: { name: 'SaveServiceOrderItems' },
  });

  const addedItemCount = (r: Res) => {
    try {
      const map = (r.json() as unknown as ServiceOrderSaveResult[])[0].AdditionalTableNameAddedRowKeys ?? {};
      return Object.keys(map).reduce((sum, k) => sum + (map[k]?.length ?? 0), 0);
    } catch {
      return 0;
    }
  };

  const ok = check(res, {
    'SaveServiceOrderItems: status is 201': (r) => r.status === 201,
    'SaveServiceOrderItems: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveServiceOrderItems: order row was modified': (r) => {
      try {
        return (r.json() as unknown as ServiceOrderSaveResult[])[0].ModifiedRowKeys?.includes(so.rowKey) ?? false;
      } catch {
        return false;
      }
    },
    'SaveServiceOrderItems: items were added to order': (r) => addedItemCount(r) > 0,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] saveServiceOrderItems failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  return (res.json() as unknown as ServiceOrderSaveResult[])[0];
}
