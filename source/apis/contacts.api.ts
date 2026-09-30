import http from 'k6/http';
import { check, fail, JSONValue } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, find_transport_table, get_cell, parse_grid_rows } from '../utils/exports/helpers.exp.ts';
import {
  contactObjectColumnsPayload,
  contactsListPayload,
  contactsGridPayload,
  contactDetailPayload,
  contactServiceOrdersListPayload,
  serviceOrderFormPayload,
  serviceOrderEventSearchPayload,
  serviceOrderEventRecentlyUsedPayload,
  serviceOrderEventFieldsPayload,
  serviceOrderFunctionFieldsPayload,
  contactServiceOrderSavePayload,
  orderUpsellMessageData,
} from '../utils/exports/data.exp.ts';
import {
  ContactRow,
  ContactServiceOrderSaveResult,
  ServiceOrderEventMatch,
  ServiceOrderForm,
  ServiceOrderFormBag,
  ServiceOrderFormLayout,
  ServiceOrderPrompt,
} from '../utils/exports/types.exp.ts';

const SERVICE_ORDER_OBJECT_ID = 456;
const UPSELL_ACCEPT_ANSWER = 6;

function post_contact(endpoint: string, payload: unknown, token: string, version: string, name: string) {
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

function json_at(res: ReturnType<typeof post_contact>, index: number) {
  try {
    return (res.json() as JSONValue[])[index];
  } catch {
    return undefined;
  }
}

function string_at(res: ReturnType<typeof post_contact>, index: number) {
  const value = json_at(res, index);
  return typeof value === 'string' ? value : '';
}

function is_service_order_layout(el: JSONValue): el is ServiceOrderFormLayout {
  return el !== null && typeof el === 'object' && !Array.isArray(el) && el.d3 === SERVICE_ORDER_OBJECT_ID && typeof el.d1 === 'number';
}

function save_result(res: ReturnType<typeof post_contact>) {
  const result = json_at(res, 0);
  return result !== null && typeof result === 'object' && !Array.isArray(result) ? (result as ContactServiceOrderSaveResult) : undefined;
}

export function get_contact_column_stamp(token: string, version: string, objectId: number, name = 'GetContactObjectColumns') {
  const res = post_contact('ObjectColumnCacheServer/GetObjectColumns', contactObjectColumnsPayload(objectId), token, version, name);
  const stamp = string_at(res, 2);
  if (!check(stamp, { [`${name}: returns column-cache stamp`]: (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2} /.test(s) })) {
    console.error(`[VU ${__VU}] get_contact_column_stamp failed — ${body_text(res).slice(0, 200)}`);
    fail(`${name}: no column-cache stamp`);
  }
  return stamp;
}

export function open_contacts_list(token: string, version: string, name = 'OpenContactsList') {
  post_contact('GenericListServer/GetInitialData2', contactsListPayload(), token, version, name);
}

export function read_contacts_grid(token: string, version: string, name = 'ReadContactsGrid') {
  const res = post_contact('USIDataGridServer/GetGridData2', contactsGridPayload(), token, version, name);
  return parse_grid_rows(
    res,
    {
      name: 'EV870_NAME',
      email: 'EV870_EMAIL_ADDRESS',
      acctClass: 'EV870_CLASS',
      evtSalesDesig: 'EV870_EVT_SALES_DESIG',
      pubRelDesig: 'EV870_PUBREL_DESIG',
      memberDesig: 'EV870_MEMBER_DESIG',
      arDesig: 'EV870_AR_DESIG',
      apDesig: 'EV870_AP_DESIG',
      visitorDesig: 'EV870_VISITOR_DESIG',
      regisDesig: 'EV870_REGIS_DESIG',
      persDesig: 'EV870_PERS_DESIG',
      spkrDesig: 'EV870_SPKR_DESIG',
      attendeeDesig: 'EV870_ATTENDEE_DESIG',
      primaryAcct: 'EV870_PRIMARY_ACCT',
      acctCode: 'EV870_ACCT_CODE',
      orgCode: 'EV870_ORG_CODE',
      rowKey: 'cROW_KEY',
    },
    name,
  );
}

export function open_contact_detail(token: string, version: string, contact: ContactRow, columnStamp: string, name = 'OpenContactDetail') {
  const res = post_contact('GenericDetailServer/GetInitialData2', contactDetailPayload(contact, columnStamp), token, version, name);
  if (!check(res, { [`${name}: echoes the contact account`]: (r) => body_text(r).includes(contact.acctCode) })) {
    console.error(`[VU ${__VU}] open_contact_detail failed — account ${contact.acctCode} not in response`);
    fail(`${name}: contact ${contact.acctCode} not opened`);
  }
}

export function open_contact_service_orders_list(token: string, version: string, name = 'OpenContactServiceOrdersList') {
  post_contact('GenericListServer/GetInitialData2', contactServiceOrdersListPayload(), token, version, name);
}

export function open_service_order_form(token: string, version: string, columnStamp: string, name = 'OpenServiceOrderForm') {
  const res = post_contact('GenericDetailServer/GetInitialData2', serviceOrderFormPayload(columnStamp), token, version, name);
  let layoutId = '';
  let bag: ServiceOrderFormBag = {};
  try {
    const envelope = res.json() as JSONValue[];
    const layout = envelope.find(is_service_order_layout);
    layoutId = layout ? String(layout.d1) : '';
    const rawBag = envelope[7];
    bag = typeof rawBag === 'string' ? (JSON.parse(rawBag) as ServiceOrderFormBag) : {};
  } catch {
    layoutId = '';
  }
  const form = { layoutId, startDate: bag.StartDate ?? '', endDate: bag.EndDate ?? '', status: bag.Status ?? '' };
  const ok = check(form, {
    [`${name}: returns form layout`]: (f) => /^\d+$/.test(f.layoutId),
    [`${name}: returns form dates`]: (f) => f.startDate !== '' && f.endDate !== '' && f.status !== '',
  });
  if (!ok) {
    console.error(`[VU ${__VU}] open_service_order_form failed — ${JSON.stringify(form)}`);
    fail(`${name}: no layout or form dates for object ${SERVICE_ORDER_OBJECT_ID}`);
  }
  return form;
}

export function search_service_order_event(token: string, version: string, eventName: string, name = 'SearchServiceOrderEvent') {
  const res = post_contact('USISearchComboServer/GetDynamicSearchResults', serviceOrderEventSearchPayload(eventName), token, version, name);
  let eventKey = '';
  try {
    const rows = JSON.parse(string_at(res, 0)) as ServiceOrderEventMatch[];
    eventKey = rows[0]?.Key ?? '';
  } catch {
    eventKey = '';
  }
  if (!check(eventKey, { [`${name}: finds the event`]: (k) => /^\d+$/.test(k) })) {
    console.error(`[VU ${__VU}] search_service_order_event failed — no open event matches "${eventName}": ${body_text(res).slice(0, 200)}`);
    fail(`${name}: event "${eventName}" not found`);
  }
  return eventKey;
}

export function save_recent_service_order_event(token: string, version: string, eventKey: string, name = 'SaveRecentServiceOrderEvent') {
  post_contact('USISearchComboServer/SaveRecentlyUsed', serviceOrderEventRecentlyUsedPayload(eventKey), token, version, name);
}

export function refresh_service_order_event_fields(
  token: string,
  version: string,
  form: ServiceOrderForm,
  eventKey: string,
  orderDate: string,
  name = 'HandleServiceOrderEventFields',
) {
  const res = post_contact(
    'GenericDetailServer/HandleDependentFields2',
    serviceOrderEventFieldsPayload(form.layoutId, form, eventKey, orderDate),
    token,
    version,
    name,
  );
  const header = find_transport_table(res, 'ER100_ORD_ACCT', name);
  const fields = {
    orderAcct: get_cell(header, 'ER100_ORD_ACCT'),
    start: get_cell(header, 'cSTART_DATE_TIME'),
    end: get_cell(header, 'cEND_DATE_TIME'),
  };
  const ok = check(fields, {
    [`${name}: returns the order account`]: (f) => f.orderAcct.trim() !== '',
    [`${name}: returns start and end times`]: (f) => /^-?\d+$/.test(f.start) && /^-?\d+$/.test(f.end),
  });
  if (!ok) {
    console.error(`[VU ${__VU}] refresh_service_order_event_fields failed — event ${eventKey}: ${JSON.stringify(fields)}`);
    fail(`${name}: event ${eventKey} did not populate the order`);
  }
  return fields;
}

export function refresh_service_order_function_fields(
  token: string,
  version: string,
  layoutId: string,
  startText: string,
  endText: string,
  eventKey: string,
  orderAcct: string,
  orderDate: string,
  name = 'HandleServiceOrderFunctionFields',
) {
  const res = post_contact(
    'GenericDetailServer/HandleDependentFields2',
    serviceOrderFunctionFieldsPayload(layoutId, startText, endText, eventKey, orderAcct, orderDate),
    token,
    version,
    name,
  );
  if (!check(res, { [`${name}: echoes the order account`]: (r) => body_text(r).includes(orderAcct) })) {
    console.error(`[VU ${__VU}] refresh_service_order_function_fields failed — ${body_text(res).slice(0, 300)}`);
    fail(`${name}: order account ${orderAcct} not echoed`);
  }
  const header = find_transport_table(res, 'cSTART_DATE_TIME', name);
  return { start: get_cell(header, 'cSTART_DATE_TIME'), end: get_cell(header, 'cEND_DATE_TIME') };
}

export function save_contact_service_order(
  token: string,
  version: string,
  startText: string,
  endText: string,
  eventKey: string,
  orderAcct: string,
  name = 'SaveContactServiceOrder',
) {
  const first = post_contact(
    'GenericDetailServer/Save2',
    contactServiceOrderSavePayload(startText, endText, eventKey, orderAcct, []),
    token,
    version,
    name,
  );
  const firstResult = save_result(first);
  let res = first;
  let result = firstResult;

  if (firstResult?.ResultValue !== 0) {
    const prompt = (firstResult?.MessageInfoList ?? []).find((m) => m.MessageKey === 'OrderUpsell');
    if (!check(prompt, { [`${name}: prompts for order upsell`]: (p) => p !== undefined })) {
      console.error(
        `[VU ${__VU}] save_contact_service_order failed — ResultValue ${firstResult?.ResultValue}, MessageInfoList ${JSON.stringify(firstResult?.MessageInfoList ?? null).slice(0, 400)}`,
      );
      fail(`${name} was rejected`);
    }
    const answer: ServiceOrderPrompt = { ...prompt, MessageAnswer: UPSELL_ACCEPT_ANSWER, MessageData: orderUpsellMessageData() };
    res = post_contact(
      'GenericDetailServer/Save2',
      contactServiceOrderSavePayload(startText, endText, eventKey, orderAcct, [answer]),
      token,
      version,
      `${name}Confirm`,
    );
    result = save_result(res);
  }

  if (!check(result, { [`${name}: ResultValue is 0 (success)`]: (r) => r?.ResultValue === 0 })) {
    console.error(
      `[VU ${__VU}] save_contact_service_order failed — ResultValue ${result?.ResultValue}, MessageInfoList ${JSON.stringify(result?.MessageInfoList ?? null).slice(0, 400)}`,
    );
    fail(`${name} did not succeed`);
  }
  const orderNbr = get_cell(find_transport_table(res, 'ER100_ORD_NBR', name), 'ER100_ORD_NBR');
  if (!check(orderNbr, { [`${name}: returns new order number`]: (n) => /^\d+$/.test(n) })) {
    console.error(`[VU ${__VU}] save_contact_service_order failed — no ER100_ORD_NBR in ${body_text(res).slice(0, 300)}`);
    fail(`${name}: no order number returned`);
  }
  return orderNbr;
}
