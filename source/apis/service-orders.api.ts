import http, { RefinedResponse, ResponseType } from 'k6/http';
import { check } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { buildHeaders } from '../utils/exports/helpers.exp.ts';
import { serviceOrdersGridPayload, serviceOrderDetailPayload, serviceOrderItemsSavePayload, createServiceOrderPayload } from '../utils/exports/data.exp.ts';
import { EventRow, ServiceOrderRow, ServiceOrderSaveResult } from '../utils/exports/types.exp.ts';

type Res = RefinedResponse<ResponseType | undefined>;

function parseServiceOrderRows(res: Res, name: string): ServiceOrderRow[] {
  try {
    const body: any = res.json();
    const arr = Array.isArray(body) ? body : [];
    const tdt = arr.find((e) => e && typeof e === 'object' && !Array.isArray(e) && e.TransportDataTables);
    const table = tdt.TransportDataTables.find(
      (t: any) => t.TransportDataColumns.some((c: { ColumnName: string }) => c.ColumnName === 'ER100_ORD_NBR')
    );
    const cols: string[] = table.TransportDataColumns.map((c: { ColumnName: string }) => c.ColumnName);
    const at = (v: Record<string, unknown>, n: string): string => {
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

export function loadServiceOrders(
  token: string,
  version: string,
  event: EventRow,
  name = 'LoadServiceOrders'
): ServiceOrderRow[] {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/GetInitialData2`,
    JSON.stringify(serviceOrdersGridPayload(event)),
    { headers: buildHeaders(token, version), tags: { name } }
  );

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] loadServiceOrders failed — HTTP ${res.status}`);
    return [];
  }

  return parseServiceOrderRows(res, name);
}

export function openServiceOrderDetail(
  token: string,
  version: string,
  so: ServiceOrderRow
): Res | null {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(serviceOrderDetailPayload(so)),
    { headers: buildHeaders(token, version), tags: { name: 'OpenServiceOrderDetail' } }
  );

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

export function createServiceOrder(
  token: string,
  version: string,
  encUserId: string,
  evtId: string,
  name = 'CreateServiceOrder'
): string | null {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(createServiceOrderPayload(encUserId, evtId, version)),
    { headers: buildHeaders(token, version), tags: { name } }
  );

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: ResultValue is 0 (success)`]: (r) => {
      try { return (r.json() as unknown as ServiceOrderSaveResult[])[0].ResultValue === 0; } catch { return false; }
    },
    [`${name}: returns new order row key`]: (r) => {
      try { const k = (r.json() as unknown as ServiceOrderSaveResult[])[0].AddedRowKeys; return Array.isArray(k) && k.length > 0; } catch { return false; }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] createServiceOrder failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  const addedKey = (res.json() as unknown as ServiceOrderSaveResult[])[0].AddedRowKeys?.[0];
  return addedKey ? addedKey.split('|')[1] || null : null;
}

export function saveServiceOrderItems(
  token: string,
  version: string,
  so: ServiceOrderRow,
  quantity: number
): ServiceOrderSaveResult | null {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(serviceOrderItemsSavePayload(so, quantity)),
    { headers: buildHeaders(token, version), tags: { name: 'SaveServiceOrderItems' } }
  );

  const addedItemCount = (r: Res): number => {
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
      try { return (r.json() as unknown as ServiceOrderSaveResult[])[0].ResultValue === 0; } catch { return false; }
    },
    'SaveServiceOrderItems: order row was modified': (r) => {
      try { return (r.json() as unknown as ServiceOrderSaveResult[])[0].ModifiedRowKeys?.includes(so.rowKey) ?? false; } catch { return false; }
    },
    'SaveServiceOrderItems: items were added to order': (r) => addedItemCount(r) > 0,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] saveServiceOrderItems failed — HTTP ${res.status}: ${String(res.body ?? '').slice(0, 300)}`);
    return null;
  }

  return (res.json() as unknown as ServiceOrderSaveResult[])[0];
}
