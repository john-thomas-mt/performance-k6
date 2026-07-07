import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text } from '../utils/exports/helpers.exp.ts';
import { listInitialDataPayload } from '../utils/exports/data.exp.ts';
import { NavScreen, WindowInfo } from '../utils/exports/types.exp.ts';

export function get_window_info(token: string, version: string, windowId: string) {
  const res = http.get(`${config.baseUrl}/api/WindowServer/GetWindowInfo?astrWindowID=${windowId}`, {
    headers: build_headers(token, version),
    tags: { name: 'GetWindowInfo' },
  });

  const ok = check(res, {
    'GetWindowInfo: status is 201': (r) => r.status === 201,
    'GetWindowInfo: returns ObjectID': (r) => {
      try {
        const body = r.json() as WindowInfo[];
        return typeof body[0]?.ObjectID === 'number';
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] get_window_info failed for "${windowId}" — HTTP ${res.status}`);
    fail('get_window_info did not succeed');
  }

  return (res.json() as WindowInfo[])[0].ObjectID;
}

export function get_list_initial_data(token: string, version: string, screen: NavScreen, objectId: number) {
  const res = http.post(
    `${config.baseUrl}/api/GenericListServer/GetInitialData2`,
    JSON.stringify(listInitialDataPayload(screen, objectId)),
    { headers: build_headers(token, version), tags: { name: 'GetListInitialData' } },
  );

  const ok = check(res, {
    'GetListInitialData: status is 201': (r) => r.status === 201,
    'GetListInitialData: returns grid data': (r) => body_text(r).includes('TransportDataTables'),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] get_list_initial_data failed for "${screen.label}" (${screen.windowId}) — HTTP ${res.status}`);
    fail('get_list_initial_data did not succeed');
  }
}
