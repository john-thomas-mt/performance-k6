import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, initial_data_table, find_transport_table, parse_grid_rows } from '../utils/exports/helpers.exp.ts';
import {
  bookingFormPayload,
  bookingSpaceRowsPayload,
  functionRowsPayload,
  functionGridPayload,
  bookingSavePayload,
  functionSavePayload,
  bookingAccountSearchPayload,
} from '../utils/exports/data.exp.ts';
import { TransportTable, EventSaveResult } from '../utils/exports/types.exp.ts';

export function get_window_version(token: string, version: string, windowId: string, name = 'GetBookingWindowInfo') {
  const res = http.get(`${config.baseUrl}/api/WindowServer/GetWindowInfo?astrWindowID=${windowId}`, {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: returns Version`]: (r) => {
      try {
        return typeof (r.json() as { Version?: string }[])[0]?.Version === 'string';
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] get_window_version failed for "${windowId}" — HTTP ${res.status}`);
    fail('get_window_version did not succeed');
  }

  return (res.json() as { Version: string }[])[0].Version;
}

export function stage_booking_space(token: string, version: string, date: string, space: string, name = 'StageBookingSpace') {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/CreateNewRowsWithDefaultValues`,
    JSON.stringify(bookingSpaceRowsPayload(date, space)),
    {
      headers: build_headers(token, version),
      tags: { name },
    },
  );

  const ok = check(res, { [`${name}: status is 201`]: (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] stage_booking_space failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('stage_booking_space did not succeed');
  }

  return find_transport_table(res, 'EV802_BKD_SPACE', name);
}

export function open_booking_form(token: string, version: string, date: string, name = 'OpenBookingForm') {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(bookingFormPayload(date)), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, { [`${name}: status is 201`]: (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] open_booking_form failed — HTTP ${res.status}`);
    fail('open_booking_form did not succeed');
  }

  return initial_data_table(res, name);
}

export function search_booking_account(token: string, version: string, account: string, name = 'SearchBookingAccount') {
  const res = http.post(
    `${config.baseUrl}/api/USISearchComboServer/GetDynamicSearchResults`,
    JSON.stringify(bookingAccountSearchPayload(account)),
    { headers: build_headers(token, version), tags: { name } },
  );
  check(res, { [`${name}: status is 201`]: (r) => r.status === 201 });
  try {
    const rows = JSON.parse(String((res.json() as unknown[])[0])) as { Key: string }[];
    return rows[0]?.Key ?? '';
  } catch {
    return '';
  }
}

export function save_booking(
  token: string,
  version: string,
  header: TransportTable,
  space: TransportTable,
  date: string,
  description: string,
  account: string,
  contact: string,
  name = 'SaveBooking',
) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(bookingSavePayload(header, space, date, description, account, contact)),
    {
      headers: build_headers(token, version),
      tags: { name },
    },
  );

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
    console.error(`[VU ${__VU}] save_booking failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('save_booking did not succeed');
  }

  const addedRowKey = (res.json() as EventSaveResult[])[0].AddedRowKeys[0];
  return { addedRowKey, evtId: addedRowKey.split('|')[1] };
}

export function read_event_functions(
  token: string,
  version: string,
  space: string,
  account: string,
  evtId: string,
  addedRowKey: string,
  encUserId: string,
  windowVersion: string,
  name = 'ReadEventFunctions',
) {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/GetGridData2`,
    JSON.stringify(functionGridPayload(space, account, evtId, addedRowKey, encUserId, windowVersion)),
    { headers: build_headers(token, version), tags: { name } },
  );

  const ok = check(res, { [`${name}: status is 201`]: (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] read_event_functions failed — HTTP ${res.status}`);
    fail('read_event_functions did not succeed');
  }

  const rows = parse_grid_rows(res, { stamp: 'cRETRIEVE_STAMP' }, name);
  return rows[0]?.stamp ?? '';
}

export function stage_event_function(
  token: string,
  version: string,
  date: string,
  space: string,
  account: string,
  evtId: string,
  addedRowKey: string,
  encUserId: string,
  windowVersion: string,
  stamp: string,
  name = 'StageEventFunction',
) {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/CreateNewRowsWithDefaultValues`,
    JSON.stringify(functionRowsPayload(date, space, account, evtId, addedRowKey, encUserId, windowVersion, stamp)),
    { headers: build_headers(token, version), tags: { name } },
  );

  const ok = check(res, { [`${name}: status is 201`]: (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] stage_event_function failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('stage_event_function did not succeed');
  }

  return find_transport_table(res, 'EV700_FUNC_DESC', name);
}

export function save_event_function(
  token: string,
  version: string,
  table: TransportTable,
  funcDesc: string,
  space: string,
  account: string,
  evtId: string,
  addedRowKey: string,
  encUserId: string,
  windowVersion: string,
  name = 'SaveEventFunction',
) {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/Save2`,
    JSON.stringify(functionSavePayload(table, funcDesc, space, account, evtId, addedRowKey, encUserId, windowVersion)),
    { headers: build_headers(token, version), tags: { name } },
  );

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: ResultValue is 0 (success)`]: (r) => {
      try {
        return (r.json() as EventSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    let detail = body_text(res).slice(0, 300);
    try {
      detail = JSON.stringify((res.json() as { MessageInfoList: unknown }[])[0].MessageInfoList);
    } catch {
      /* keep raw slice */
    }
    console.error(`[VU ${__VU}] save_event_function failed — HTTP ${res.status}: ${detail}`);
    fail('save_event_function did not succeed');
  }
}
