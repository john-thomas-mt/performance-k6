import { group } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  get_window_version,
  stage_booking_space,
  open_booking_form,
  search_booking_account,
  refresh_booking_account_fields,
  save_booking,
  read_event_functions,
  stage_event_function,
  save_event_function,
  signalr_negotiate,
} from '../utils/exports/apis.exp.ts';
import {
  sign_out,
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
  fetch_bundle_versions,
  think,
  format_retrieve_stamp,
  get_cell,
  pick_pool_value,
} from '../utils/exports/helpers.exp.ts';
import {
  random_future_date,
  bookingSpaces,
  bookingAccountNames,
  bookEventChrome,
  bookEventStatic,
  bookEventTransport,
} from '../utils/exports/data.exp.ts';
import { User, SetupData, TransportTable, FidelityLevel } from '../utils/exports/types.exp.ts';

export const bookEventThresholds = {
  'http_req_duration{name:GetBookingWindowInfo}': ['avg<4000'],
  'http_req_duration{name:StageBookingSpace}': ['avg<4000'],
  'http_req_duration{name:OpenBookingForm}': ['avg<4000'],
  'http_req_duration{name:SearchBookingAccount}': ['avg<4000'],
  'http_req_duration{name:HandleBookingAccountFields}': ['avg<4000'],
  'http_req_duration{name:SaveBooking}': ['avg<4000'],
  'http_req_duration{name:ReadEventFunctions}': ['avg<4000'],
  'http_req_duration{name:StageEventFunction}': ['avg<4000'],
  'http_req_duration{name:SaveEventFunction}': ['avg<4000'],
};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, bookEventChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(bookEventStatic[step] ?? []);
      fire_transport(token, version, bookEventTransport[step] ?? [], subs);
    }
  }
}

export function book_event_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const runToken = `${__VU}${exec.scenario.iterationInTest}${Date.now()}`;
  const date = random_future_date();
  const spaceCode = pick_pool_value(bookingSpaces);
  const accountName = pick_pool_value(bookingAccountNames);
  const eventDesc = `k6-t2-booking-event-${runToken}`;

  const subs: Subs = {
    'C_USI_Version': data.version,
    'P_BookingEvent_Date': date,
    'P_26_2_BE_SpaceCode.spaceCodes': spaceCode,
    'C_ALT_EVT_DESC': eventDesc,
    'C_EVT_SEARCH': '*EVTYR',
    'C_NG_EVT_CONTACT': '',
    'C_BE_searchResultKey': '',
    'NL-VirtualUserId': String(__VU),
    'P_IterationNumber': String(__ITER),
    'P_EpochTimestamp': String(Date.now()),
  };

  group('T002_BookingEvent_01_Launch', () => {
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
    }
    chrome_and_static('', data.version, level, ['01'], subs);
  });
  think();

  const { bearerToken, encUserId } = login_to_events(user, data.version, 'T002_BookingEvent_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  let windowVersion = '';
  group('T002_BookingEvent_03_ClickCalenderTab', () => {
    windowVersion = get_window_version(bearerToken, data.version, 'EB8776');
    subs.C_Version = windowVersion;
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  group('T002_BookingEvent_04_SelectDateSpace', () => {
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
  });
  think();

  let spaceTableRef: TransportTable | null = null;
  group('T002_BookingEvent_05_SelectSpaceSlot', () => {
    spaceTableRef = stage_booking_space(bearerToken, data.version, date, spaceCode);
    subs.C_BKD_SPACE = get_cell(spaceTableRef, 'EV802_BKD_SPACE');
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  think();

  let formTableRef: TransportTable | null = null;
  group('T002_BookingEvent_06_ClickBookButton', () => {
    formTableRef = open_booking_form(bearerToken, data.version, date);
    subs.C_EVT_START_DATE = get_cell(formTableRef, 'EV200_EVT_START_DATE');
    subs.C_EVT_END_DATE = get_cell(formTableRef, 'EV200_EVT_END_DATE');
    subs.C_ADV_CUTOFF_DATE = get_cell(formTableRef, 'EV200_ADV_CUTOFF_DATE');
    subs.C_STD_CUTOFF_DATE = get_cell(formTableRef, 'EV200_STD_CUTOFF_DATE');
    subs.C_RELEASE_DATE = get_cell(formTableRef, 'EV200_RELEASE_DATE');
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  think();

  let bookingRef: { addedRowKey: string; evtId: string } | null = null;
  let account = '';
  group('T002_BookingEvent_07_EnterdetailsClicksave', () => {
    account = search_booking_account(bearerToken, data.version, accountName);
    subs.C_BE_searchResultKey = account;
    const contact = refresh_booking_account_fields(bearerToken, data.version, formTableRef!, date, account);
    subs.C_NG_EVT_CONTACT = contact;
    const booked = save_booking(bearerToken, data.version, formTableRef!, spaceTableRef!, date, eventDesc, account, contact);
    bookingRef = booked;
    subs.C_EVT_ID = booked.evtId;
    subs.C_AddedRowKeys = booked.addedRowKey;
    console.log(`[VU ${__VU}] Booked event ${booked.evtId} — ${eventDesc}`);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  const booking = bookingRef!;
  think();

  let stamp = '';
  group('T002_BookingEvent_08_SelectEventFunctionOnActionButton', () => {
    stamp = read_event_functions(
      bearerToken,
      data.version,
      spaceCode,
      account,
      booking.evtId,
      booking.addedRowKey,
      encUserId,
      windowVersion,
    );
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();

  let funcTableRef: TransportTable | null = null;
  group('T002_BookingEvent_09_AddFunction', () => {
    funcTableRef = stage_event_function(
      bearerToken,
      data.version,
      date,
      spaceCode,
      account,
      booking.evtId,
      booking.addedRowKey,
      encUserId,
      windowVersion,
      format_retrieve_stamp(stamp),
    );
    chrome_and_static(bearerToken, data.version, level, ['09'], subs);
  });
  think();

  group('T002_BookingEvent_10_ClickFunctionSave', () => {
    save_event_function(
      bearerToken,
      data.version,
      funcTableRef!,
      `k6-t2-function-${runToken}`,
      spaceCode,
      account,
      booking.evtId,
      booking.addedRowKey,
      encUserId,
      windowVersion,
      Date.now(),
    );
    read_event_functions(bearerToken, data.version, spaceCode, account, booking.evtId, booking.addedRowKey, encUserId, windowVersion);
    chrome_and_static(bearerToken, data.version, level, ['10'], subs);
  });
  think();

  group('T002_BookingEvent_11_SignOut', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['11'], subs);
  });
  think();
}
