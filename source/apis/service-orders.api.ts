import http from 'k6/http';
import { check, fail } from 'k6';
import { b64encode } from 'k6/encoding';
import { config } from '../utils/exports/config.exp.ts';
import {
  build_headers,
  body_text,
  parse_grid_rows,
  find_transport_table,
  get_cell,
  coerce_transport_types,
} from '../utils/exports/helpers.exp.ts';
import {
  serviceOrdersGridPayload,
  eventServiceOrdersRefreshPayload,
  createServiceOrderPayload,
  cacheFilesPayload,
  copyServiceOrdersFormPayload,
  copyServiceOrdersSavePayload,
  serviceOrderControlInfoPayload,
  serviceOrderEditOpenPayload,
  serviceOrderEditReopenPayload,
  serviceOrderEditItemsFormPayload,
  serviceOrderEditDocumentFormPayload,
  serviceOrderEditFieldsPayload,
  serviceOrderEditDocumentFieldsPayload,
  serviceOrderEditHeaderSavePayload,
  serviceOrderCloseSavePayload,
  serviceOrderEditDataPayload,
  serviceOrderEditLinesGridPayload,
  serviceOrderEditLinesSearchPayload,
  serviceOrderEditItemsGridPayload,
  serviceOrderEditItemsSearchPayload,
  serviceOrderEditLinesReadPayload,
  serviceOrderEditDocumentsGridPayload,
  serviceOrderEditDocumentsSearchPayload,
  serviceOrderEditDocumentsReadPayload,
  serviceOrderEditItemsSavePayload,
  serviceOrderEditDocumentSavePayload,
} from '../utils/exports/data.exp.ts';
import {
  EventRow,
  ServiceOrderDocumentFields,
  ServiceOrderFormBag,
  ServiceOrderItemsForm,
  ServiceOrderRow,
  ServiceOrderSaveResult,
  TransportTable,
} from '../utils/exports/types.exp.ts';

export const serviceOrderColumns = {
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
  acctName: 'OrderAccount_EV870_NAME',
  funcDesc: 'OrderFunc_EV700_FUNC_DESC',
  updDateIso: 'ER100_UPD_DATE_ISO',
};

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

  return parse_grid_rows(res, serviceOrderColumns, name, (tables) =>
    tables.find((t) => t.TransportDataColumns.some((c) => c.ColumnName === 'ER100_ORD_NBR')),
  );
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

export function cache_document_file(token: string, version: string, fileName: string, fileContent: ArrayBuffer, name = 'CacheFiles') {
  const res = http.post(
    `${config.baseUrl}/api/GenericServer/CacheFiles`,
    JSON.stringify(cacheFilesPayload(fileName, b64encode(fileContent))),
    { headers: build_headers(token, version), tags: { name } },
  );

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: returns a cached file ref`]: (r) => {
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

export function read_event_service_orders_grid(
  token: string,
  version: string,
  anchor: ServiceOrderRow,
  eventRowKey: string,
  name = 'ReadServiceOrderGrid',
) {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/GetGridData2`,
    JSON.stringify(eventServiceOrdersRefreshPayload(anchor, eventRowKey)),
    { headers: build_headers(token, version), tags: { name } },
  );

  check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });
}

export function get_service_order_control_info(
  token: string,
  version: string,
  rep: ServiceOrderRow,
  eventRowKey: string,
  name = 'GetControlInfo',
) {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/GetControlInfo`,
    JSON.stringify(serviceOrderControlInfoPayload(rep, eventRowKey)),
    { headers: build_headers(token, version), tags: { name } },
  );

  check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });
}

export function open_service_order_copy_form(
  token: string,
  version: string,
  encUserId: string,
  orders: ServiceOrderRow[],
  refreshKey: number,
) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(copyServiceOrdersFormPayload(encUserId, orders, version, refreshKey)),
    { headers: build_headers(token, version), tags: { name: 'OpenCopyServiceOrdersForm' } },
  );

  const ok = check(res, {
    'OpenCopyServiceOrdersForm: status is 201': (r) => r.status === 201,
    'OpenCopyServiceOrdersForm: returns copy form data': (r) => body_text(r).length > 1000,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_service_order_copy_form failed — HTTP ${res.status}`);
    fail('open_service_order_copy_form did not succeed');
  }
}

export function save_service_order_copy(token: string, version: string, encUserId: string, orders: ServiceOrderRow[], refreshKey: number) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(copyServiceOrdersSavePayload(encUserId, orders, version, refreshKey)),
    { headers: build_headers(token, version), tags: { name: 'SaveServiceOrderCopy' } },
  );

  const ok = check(res, {
    'SaveServiceOrderCopy: status is 201': (r) => r.status === 201,
    'SaveServiceOrderCopy: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as ServiceOrderSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveServiceOrderCopy: new orders were created': (r) => {
      try {
        const k = (r.json() as ServiceOrderSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] save_service_order_copy failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('save_service_order_copy did not succeed');
  }

  return (res.json() as ServiceOrderSaveResult[])[0].AddedRowKeys ?? [];
}

function post_order_window(endpoint: string, payload: unknown, token: string, version: string, name: string) {
  const res = http.post(`${config.baseUrl}/api/${endpoint}`, JSON.stringify(payload), {
    headers: build_headers(token, version),
    tags: { name },
  });
  if (!check(res, { [`${name}: status is 201`]: (r) => r.status === 201 })) {
    console.error(`[VU ${__VU}] ${name} failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail(`${name} did not return 201`);
  }
  return res;
}

function assert_order_saved(res: ReturnType<typeof post_order_window>, name: string) {
  const saved = (() => {
    try {
      return (res.json() as ServiceOrderSaveResult[])[0];
    } catch {
      return undefined;
    }
  })();
  if (!check(saved, { [`${name}: ResultValue is 0 (success)`]: (r) => r?.ResultValue === 0 })) {
    console.error(`[VU ${__VU}] ${name} failed — ResultValue ${saved?.ResultValue}: ${body_text(res).slice(0, 400)}`);
    fail(`${name} did not succeed`);
  }
  return saved;
}

function opened_order_header(res: ReturnType<typeof post_order_window>, row: ServiceOrderRow, name: string) {
  const header = find_transport_table(res, 'ER100_ORD_TOT', name);
  if (!check(header, { [`${name}: opens the order`]: (t) => get_cell(t, 'ER100_ORD_NBR') === row.orderNbr })) {
    console.error(`[VU ${__VU}] ${name} failed — order ${row.orderNbr} not in the response`);
    fail(`${name}: order ${row.orderNbr} not opened`);
  }
  return coerce_transport_types(header);
}

export function open_service_order_for_edit(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderForEdit',
) {
  const res = post_order_window(
    'GenericDetailServer/GetInitialData2',
    serviceOrderEditOpenPayload(row, wdwid, refreshKey),
    token,
    version,
    name,
  );
  return opened_order_header(res, row, name);
}

export function reopen_service_order_after_items(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'ReopenServiceOrderAfterItems',
) {
  const res = post_order_window(
    'GenericDetailServer/GetInitialData2',
    serviceOrderEditReopenPayload(row, wdwid, refreshKey),
    token,
    version,
    name,
  );
  return opened_order_header(res, row, name);
}

export function refresh_service_order_edit_fields(
  token: string,
  version: string,
  row: ServiceOrderRow,
  eventDesc: string,
  header: TransportTable,
  wdwid: string,
  refreshKey: number,
  name = 'HandleServiceOrderEditFields',
) {
  post_order_window(
    'GenericDetailServer/HandleDependentFields2',
    serviceOrderEditFieldsPayload(row, eventDesc, coerce_transport_types(header), wdwid, refreshKey),
    token,
    version,
    name,
  );
}

export function save_service_order_header(
  token: string,
  version: string,
  row: ServiceOrderRow,
  eventDesc: string,
  header: TransportTable,
  orderDate: number,
  wdwid: string,
  refreshKey: number,
  name = 'SaveServiceOrderHeader',
) {
  const res = post_order_window(
    'GenericDetailServer/Save2',
    serviceOrderEditHeaderSavePayload(row, eventDesc, coerce_transport_types(header), orderDate, wdwid, refreshKey),
    token,
    version,
    name,
  );
  assert_order_saved(res, name);
}

export function save_service_order_close(
  token: string,
  version: string,
  row: ServiceOrderRow,
  eventDesc: string,
  header: TransportTable,
  orderDate: number,
  wdwid: string,
  refreshKey: number,
  name = 'SaveServiceOrderClose',
) {
  const res = post_order_window(
    'GenericDetailServer/Save2',
    serviceOrderCloseSavePayload(row, eventDesc, coerce_transport_types(header), orderDate, wdwid, refreshKey),
    token,
    version,
    name,
  );
  assert_order_saved(res, name);
}

export function read_service_order_data(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'ReadServiceOrderData',
) {
  post_order_window('GenericDetailServer/GetData2', serviceOrderEditDataPayload(row, wdwid, refreshKey), token, version, name);
}

export function open_service_order_lines_grid(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderLinesGrid',
) {
  post_order_window('USIDataGridServer/GetInitialData2', serviceOrderEditLinesGridPayload(row, wdwid, refreshKey), token, version, name);
}

export function open_service_order_lines_search(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderLinesSearch',
) {
  post_order_window(
    'GenericSearchServer/GetInitialData2',
    serviceOrderEditLinesSearchPayload(row, wdwid, refreshKey),
    token,
    version,
    name,
  );
}

export function read_service_order_lines(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'ReadServiceOrderLines',
) {
  post_order_window('USIDataGridServer/GetGridData2', serviceOrderEditLinesReadPayload(row, wdwid, refreshKey), token, version, name);
}

export function open_service_order_items_form(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderItemsForm',
) {
  const res = post_order_window(
    'GenericDetailServer/GetInitialData2',
    serviceOrderEditItemsFormPayload(row, wdwid, refreshKey),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'cCUSTOM_FIELD_2161', name);
  let bag: ServiceOrderFormBag = {};
  try {
    const rawBag = (res.json() as unknown[])[7];
    bag = typeof rawBag === 'string' ? (JSON.parse(rawBag) as ServiceOrderFormBag) : {};
  } catch {
    bag = {};
  }
  const form = { startDate: bag.StartDate ?? '', endDate: bag.EndDate ?? '', table: coerce_transport_types(table) };
  if (!check(form, { [`${name}: returns the form dates`]: (f) => f.startDate !== '' && f.endDate !== '' })) {
    console.error(`[VU ${__VU}] ${name} failed — no StartDate/EndDate for order ${row.orderNbr}`);
    fail(`${name}: no form dates`);
  }
  return form;
}

export function read_service_order_add_items(
  token: string,
  version: string,
  row: ServiceOrderRow,
  startDate: string,
  endDate: string,
  wdwid: string,
  refreshKey: number,
  name = 'ReadServiceOrderAddItems',
) {
  const res = post_order_window(
    'USIDataGridServer/GetInitialData2',
    serviceOrderEditItemsGridPayload(row, startDate, endDate, wdwid, refreshKey),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'CC716_DESC', name);
  if (!check(table, { [`${name}: returns items to add`]: (t) => t.TransportDataRows.length > 0 })) {
    console.error(`[VU ${__VU}] ${name} failed — no items for order ${row.orderNbr} (${startDate}-${endDate})`);
    fail(`${name}: no items to add`);
  }
  return table;
}

export function open_service_order_items_search(
  token: string,
  version: string,
  row: ServiceOrderRow,
  startDate: string,
  endDate: string,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderItemsSearch',
) {
  post_order_window(
    'GenericSearchServer/GetInitialData2',
    serviceOrderEditItemsSearchPayload(row, startDate, endDate, wdwid, refreshKey),
    token,
    version,
    name,
  );
}

export function save_service_order_items(
  token: string,
  version: string,
  row: ServiceOrderRow,
  form: ServiceOrderItemsForm,
  item: TransportTable,
  quantity: number,
  wdwid: string,
  refreshKey: number,
  name = 'SaveServiceOrderItems',
) {
  const res = post_order_window(
    'GenericDetailServer/Save2',
    serviceOrderEditItemsSavePayload(
      row,
      coerce_transport_types(form.table),
      coerce_transport_types(item),
      quantity,
      form.startDate,
      form.endDate,
      wdwid,
      refreshKey,
    ),
    token,
    version,
    name,
  );
  assert_order_saved(res, name);
}

export function open_service_order_documents_grid(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderDocumentsGrid',
) {
  post_order_window(
    'USIDataGridServer/GetInitialData2',
    serviceOrderEditDocumentsGridPayload(row, wdwid, refreshKey),
    token,
    version,
    name,
  );
}

export function open_service_order_documents_search(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderDocumentsSearch',
) {
  post_order_window(
    'GenericSearchServer/GetInitialData2',
    serviceOrderEditDocumentsSearchPayload(row, wdwid, refreshKey),
    token,
    version,
    name,
  );
}

export function open_service_order_document_form(
  token: string,
  version: string,
  row: ServiceOrderRow,
  fileKey: string,
  fileName: string,
  wdwid: string,
  refreshKey: number,
  name = 'OpenServiceOrderDocumentForm',
) {
  post_order_window(
    'GenericDetailServer/GetInitialData2',
    serviceOrderEditDocumentFormPayload(row, fileKey, fileName, wdwid, refreshKey),
    token,
    version,
    name,
  );
}

export function refresh_service_order_document_fields(
  token: string,
  version: string,
  row: ServiceOrderRow,
  docDesc: string,
  fileKey: string,
  fileName: string,
  wdwid: string,
  refreshKey: number,
  name = 'HandleServiceOrderDocumentFields',
) {
  const res = post_order_window(
    'GenericDetailServer/HandleDependentFields2',
    serviceOrderEditDocumentFieldsPayload(row, docDesc, fileKey, fileName, wdwid, refreshKey),
    token,
    version,
    name,
  );
  const table = find_transport_table(res, 'MM446_DOC_DESC', name);
  const doc = {
    docDesc: get_cell(table, 'MM446_DOC_DESC'),
    fileName: get_cell(table, 'cDOC_FILE_NAME'),
    fileKey: get_cell(table, 'cFILE_KEY'),
    evFunc: get_cell(table, 'MM446_EV_FUNC'),
  };
  if (
    !check(doc, {
      [`${name}: returns the document row`]: (d) => d.docDesc !== '' && d.fileName !== '' && d.fileKey !== '' && d.evFunc !== '',
    })
  ) {
    console.error(`[VU ${__VU}] ${name} failed — ${JSON.stringify(doc)}`);
    fail(`${name}: incomplete document row`);
  }
  return doc;
}

export function save_service_order_document(
  token: string,
  version: string,
  row: ServiceOrderRow,
  doc: ServiceOrderDocumentFields,
  wdwid: string,
  refreshKey: number,
  name = 'SaveServiceOrderDocument',
) {
  const res = post_order_window(
    'GenericDetailServer/Save2',
    serviceOrderEditDocumentSavePayload(row, doc, wdwid, refreshKey),
    token,
    version,
    name,
  );
  const saved = assert_order_saved(res, name);
  if (!check(saved, { [`${name}: adds the document row`]: (r) => Array.isArray(r?.AddedRowKeys) && r.AddedRowKeys.length > 0 })) {
    console.error(`[VU ${__VU}] ${name} failed — no document row key returned`);
    fail(`${name}: no document row added`);
  }
}

export function read_service_order_documents(
  token: string,
  version: string,
  row: ServiceOrderRow,
  wdwid: string,
  refreshKey: number,
  name = 'ReadServiceOrderDocuments',
) {
  const res = post_order_window(
    'USIDataGridServer/GetGridData2',
    serviceOrderEditDocumentsReadPayload(row, wdwid, refreshKey),
    token,
    version,
    name,
  );
  const echoed = /RefreshDependentKey\\+":(\d+)/.exec(body_text(res))?.[1];
  if (!check(echoed, { [`${name}: echoes the refresh key`]: (k) => k !== undefined })) {
    console.error(`[VU ${__VU}] ${name} failed — no RefreshDependentKey in ${body_text(res).slice(0, 200)}`);
    fail(`${name}: no refresh key returned`);
  }
  return Number(echoed);
}
