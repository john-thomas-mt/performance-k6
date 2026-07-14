import { group, sleep } from 'k6';
import { login_to_events } from './login.flow.ts';
import {
  get_window_version,
  stage_booking_space,
  open_booking_form,
  save_booking,
  read_event_functions,
  stage_event_function,
  save_event_function,
} from '../utils/exports/apis.exp.ts';
import {
  sign_out,
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  think,
  format_retrieve_stamp,
} from '../utils/exports/helpers.exp.ts';
import {
  random_future_date,
  bookingSpaces,
  BOOKING_ACCOUNT,
  BOOKING_CONTACT,
  bookEventChrome,
  bookEventStatic,
} from '../utils/exports/data.exp.ts';
import { User, SetupData, TransportTable, FidelityLevel } from '../utils/exports/types.exp.ts';

export const bookEventThresholds = {
  'http_req_duration{name:StageBookingSpace}': ['p(95)<8000'],
  'http_req_duration{name:OpenBookingForm}': ['p(95)<8000'],
  'http_req_duration{name:SaveBooking}': ['p(95)<8000'],
  'http_req_duration{name:StageEventFunction}': ['p(95)<8000'],
  'http_req_duration{name:SaveEventFunction}': ['p(95)<8000'],
};

function chrome_and_static(token: string, version: string, level: FidelityLevel, step: string) {
  if (include_ui(level)) fire_ui_chrome(token, version, bookEventChrome[step] ?? []);
  if (include_static(level)) fire_static_assets(bookEventStatic[step] ?? []);
}

export function book_event_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const runToken = crypto.randomUUID().split('-')[0];
  const date = random_future_date();
  const spaceCode = bookingSpaces[__VU % bookingSpaces.length];
  const eventDesc = `Perf Booking ${runToken}`;

  const { bearerToken, encUserId } = login_to_events(user, data.version);
  chrome_and_static(bearerToken, data.version, level, '02');

  let windowVersion = '';
  group('3. Open Booking Calendar', () => {
    windowVersion = get_window_version(bearerToken, data.version, 'EB8776');
    chrome_and_static(bearerToken, data.version, level, '03');
  });
  think(3);

  let spaceTableRef: TransportTable | null = null;
  group('4. Stage Booked Space', () => {
    spaceTableRef = stage_booking_space(bearerToken, data.version, date, spaceCode);
    chrome_and_static(bearerToken, data.version, level, '05');
  });
  think(2);

  let formTableRef: TransportTable | null = null;
  group('5. Open Booking Form', () => {
    formTableRef = open_booking_form(bearerToken, data.version, date);
    chrome_and_static(bearerToken, data.version, level, '06');
  });
  think(5);

  let bookingRef: { addedRowKey: string; evtId: string } | null = null;
  group('6. Save Booking', () => {
    const booked = save_booking(
      bearerToken,
      data.version,
      formTableRef!,
      spaceTableRef!,
      date,
      eventDesc,
      BOOKING_ACCOUNT,
      BOOKING_CONTACT,
    );
    bookingRef = booked;
    console.log(`[VU ${__VU}] Booked event ${booked.evtId} — ${eventDesc}`);
    chrome_and_static(bearerToken, data.version, level, '07');
  });
  const booking = bookingRef!;
  think(4);

  let funcTableRef: TransportTable | null = null;
  group('7. Stage Event Function', () => {
    const stamp = read_event_functions(
      bearerToken,
      data.version,
      spaceCode,
      BOOKING_ACCOUNT,
      booking.evtId,
      booking.addedRowKey,
      encUserId,
      windowVersion,
    );
    funcTableRef = stage_event_function(
      bearerToken,
      data.version,
      date,
      spaceCode,
      BOOKING_ACCOUNT,
      booking.evtId,
      booking.addedRowKey,
      encUserId,
      windowVersion,
      format_retrieve_stamp(stamp),
    );
    chrome_and_static(bearerToken, data.version, level, '09');
  });
  think(3);

  group('8. Save Event Function', () => {
    read_event_functions(
      bearerToken,
      data.version,
      spaceCode,
      BOOKING_ACCOUNT,
      booking.evtId,
      booking.addedRowKey,
      encUserId,
      windowVersion,
    );
    save_event_function(
      bearerToken,
      data.version,
      funcTableRef!,
      `Function ${runToken}`,
      spaceCode,
      BOOKING_ACCOUNT,
      booking.evtId,
      booking.addedRowKey,
      encUserId,
      windowVersion,
    );
    chrome_and_static(bearerToken, data.version, level, '10');
  });
  think(2);

  group('9. Sign Out', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, '11');
  });

  sleep(1);
}
