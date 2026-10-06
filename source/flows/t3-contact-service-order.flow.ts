import { check, fail, group } from 'k6';
import { login_to_events } from './login.flow.ts';
import {
  get_contact_column_stamp,
  open_contacts_list,
  read_contacts_grid,
  open_contact_detail,
  open_contact_service_orders_list,
  open_service_order_form,
  search_service_order_event,
  save_recent_service_order_event,
  refresh_service_order_event_fields,
  refresh_service_order_function_fields,
  read_service_order_items_grid,
  save_contact_service_order,
  open_order_upsell_drawer,
  confirm_contact_service_order,
  signalr_negotiate,
} from '../utils/exports/apis.exp.ts';
import {
  fetch_bundle_versions,
  fidelity_level,
  fire_static_assets,
  fire_transport,
  fire_ui_chrome,
  format_retrieve_stamp,
  include_static,
  include_ui,
  pick_pool_value,
  sign_out,
  stamp_to_epoch,
  think,
} from '../utils/exports/helpers.exp.ts';
import {
  contactServiceOrderChrome,
  contactServiceOrderStatic,
  contactServiceOrderTransport,
  serviceOrderEventNames,
} from '../utils/exports/data.exp.ts';
import { ContactRow, FidelityLevel, ServiceOrderForm, SetupData, User } from '../utils/exports/types.exp.ts';

const CONTACT_OBJECT_ID = 286;
const CONTACT_VIEW_OBJECT_ID = 1659;
const SERVICE_ORDER_OBJECT_ID = 456;
const ORDER_UPSELL_OBJECT_ID = 2556;

export const contactServiceOrderThresholds = {
  'http_req_duration{name:GetContactObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenContactsList}': ['avg<4000'],
  'http_req_duration{name:ReadContactsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenContactDetail}': ['avg<4000'],
  'http_req_duration{name:GetContactViewObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenContactServiceOrdersList}': ['avg<4000'],
  'http_req_duration{name:GetServiceOrderObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenServiceOrderForm}': ['avg<4000'],
  'http_req_duration{name:SearchServiceOrderEvent}': ['avg<4000'],
  'http_req_duration{name:SaveRecentServiceOrderEvent}': ['avg<4000'],
  'http_req_duration{name:HandleServiceOrderEventFields}': ['avg<4000'],
  'http_req_duration{name:ReadServiceOrderItemsGrid}': ['avg<4000'],
  'http_req_duration{name:HandleServiceOrderFunctionFields}': ['avg<4000'],
  'http_req_duration{name:SaveContactServiceOrder}': ['avg<4000'],
  'http_req_duration{name:GetOrderUpsellObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenOrderUpsellDrawer}': ['avg<4000'],
  'http_req_duration{name:SaveContactServiceOrderConfirm}': ['avg<4000'],
};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, step: string, subs: Subs) {
  if (include_ui(level)) fire_ui_chrome(token, version, contactServiceOrderChrome[step] ?? [], subs);
  if (include_static(level)) {
    fire_static_assets(contactServiceOrderStatic[step] ?? []);
    fire_transport(token, version, contactServiceOrderTransport[step] ?? [], subs);
  }
}

function contact_subs(contact: ContactRow): Subs {
  return {
    C_EMAIL_ADDRESS: contact.email,
    C_CLASS: contact.acctClass,
    C_EVT_SALES_DESIG: contact.evtSalesDesig,
    C_PUBREL_DESIG: contact.pubRelDesig,
    C_MEMBER_DESIG: contact.memberDesig,
    C_AR_DESIG: contact.arDesig,
    C_AP_DESIG: contact.apDesig,
    C_VISITOR_DESIG: contact.visitorDesig,
    C_REGIS_DESIG: contact.regisDesig,
    C_PERS_DESIG: contact.persDesig,
    C_SPKR_DESIG: contact.spkrDesig,
    C_ATTENDEE_DESIG: contact.attendeeDesig,
    C_PRIMARY_ACCT: contact.primaryAcct,
    C_ACCT_CODE: contact.acctCode,
  };
}

export function contact_service_order_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const eventName = __ENV.SERVICE_ORDER_EVENT || pick_pool_value(serviceOrderEventNames);
  const subs: Subs = { P_EpochTimestamp: String(Date.now()) };

  group('T003_ViewContact_ServiceOrders_01_Launch', () => {
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
    }
    chrome_and_static('', data.version, level, '01', subs);
  });
  think();

  const { bearerToken } = login_to_events(user, data.version, 'T003_ViewContact_ServiceOrders_02_Login', (token, encUserId, sso) => {
    subs.C_EncID = encUserId;
    subs.C_UserId = token.split('|')[0];
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, '02', subs);
  });
  think();

  let contact: ContactRow | undefined;
  let contactStamp = '';
  group('T003_ViewContact_ServiceOrders_03_ClickContactTab', () => {
    contactStamp = get_contact_column_stamp(bearerToken, data.version, CONTACT_OBJECT_ID);
    open_contacts_list(bearerToken, data.version);
    const rows = read_contacts_grid(bearerToken, data.version).filter((r) => r.acctCode !== '');
    contact = rows[Math.floor(Math.random() * rows.length)];
    check(contact, { 'Contact row found': (c) => c !== undefined });
    chrome_and_static(bearerToken, data.version, level, '03', subs);
  });
  if (!contact) fail('contacts grid returned no rows');
  const picked: ContactRow = contact;
  Object.assign(subs, contact_subs(picked));
  think();

  group('T003_ViewContact_ServiceOrders_04_ViewContact', () => {
    open_contact_detail(bearerToken, data.version, picked, contactStamp);
    if (include_ui(level)) {
      subs.C_ViewContact_Timestamp1 = get_contact_column_stamp(
        bearerToken,
        data.version,
        CONTACT_VIEW_OBJECT_ID,
        'GetContactViewObjectColumns',
      );
    }
    chrome_and_static(bearerToken, data.version, level, '04', subs);
  });
  think();

  group('T003_ViewContact_ServiceOrders_05_ClickServiceOrdersTab', () => {
    open_contact_service_orders_list(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, '05', subs);
  });
  think();

  let form: ServiceOrderForm = { layoutId: '', startDate: '', endDate: '', status: '' };
  let orderDate = '';
  group('T003_ViewContact_ServiceOrders_06_ClickAddbuttton', () => {
    const formStamp = get_contact_column_stamp(bearerToken, data.version, SERVICE_ORDER_OBJECT_ID, 'GetServiceOrderObjectColumns');
    orderDate = stamp_to_epoch(formStamp);
    form = open_service_order_form(bearerToken, data.version, formStamp);
    subs.C_StartDate = form.startDate;
    subs.C_EndDate = form.endDate;
    subs.C_Status = form.status;
    chrome_and_static(bearerToken, data.version, level, '06', subs);
  });
  think();

  let eventKey = '';
  let orderAcct = '';
  let startText = '';
  let endText = '';
  group('T003_ViewContact_ServiceOrders_07_ClickAddServiceOrder', () => {
    eventKey = search_service_order_event(bearerToken, data.version, eventName);
    save_recent_service_order_event(bearerToken, data.version, eventKey);
    const header = refresh_service_order_event_fields(bearerToken, data.version, form, eventKey, orderDate);
    orderAcct = header.orderAcct;
    startText = format_retrieve_stamp(header.start);
    endText = format_retrieve_stamp(header.end);
    const itemCount = read_service_order_items_grid(bearerToken, data.version, '0', startText, endText, eventKey, 0);
    const functionDates = refresh_service_order_function_fields(
      bearerToken,
      data.version,
      form.layoutId,
      startText,
      endText,
      eventKey,
      orderAcct,
      orderDate,
    );
    read_service_order_items_grid(bearerToken, data.version, '1', startText, endText, eventKey, itemCount);
    Object.assign(subs, {
      C_EventKey: eventKey,
      C_ORD_ACCT: orderAcct,
      Formatted_C_cSTART_DATE_TIME: startText,
      Formatted_C_cEND_DATE_TIME: endText,
      C_cSTART_DATE_TIME_1: functionDates.start,
      C_cEND_DATE_TIME_1: functionDates.end,
    });
    chrome_and_static(bearerToken, data.version, level, '07', subs);
  });
  think();

  group('T003_ViewContact_ServiceOrders_08_EnterDetailsClickSave', () => {
    const saved = save_contact_service_order(bearerToken, data.version, startText, endText, eventKey, orderAcct);
    let orderNbr = saved.orderNbr;
    if (saved.upsell) {
      const upsellStamp = get_contact_column_stamp(bearerToken, data.version, ORDER_UPSELL_OBJECT_ID, 'GetOrderUpsellObjectColumns');
      open_order_upsell_drawer(bearerToken, data.version, saved.upsell, upsellStamp);
      orderNbr = confirm_contact_service_order(bearerToken, data.version, startText, endText, eventKey, orderAcct, saved.upsell);
    }
    console.log(`[VU ${__VU}] Created service order ${orderNbr} on event ${eventKey} for ${orderAcct}`);
    chrome_and_static(bearerToken, data.version, level, '08', subs);
  });
  think();

  group('T003_ViewContact_ServiceOrders_09_SignOut', () => {
    chrome_and_static(bearerToken, data.version, level, '09', subs);
    sign_out(bearerToken, data.version);
  });
  think();
}
