import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { buildHeaders } from '../utils/exports/helpers.exp.ts';
import { listInitialDataPayload } from '../utils/exports/data.exp.ts';
import { NavScreen, WindowInfo } from '../utils/exports/types.exp.ts';

export function getWindowInfo(token: string, version: string, windowId: string) {
  const res = http.get(`${config.baseUrl}/api/WindowServer/GetWindowInfo?astrWindowID=${windowId}`, {
    headers: buildHeaders(token, version),
    tags: { name: 'GetWindowInfo' },
  });

  const ok = check(res, {
    'GetWindowInfo: status is 201': (r) => r.status === 201,
    'GetWindowInfo: returns ObjectID': (r) => {
      try {
        const body = r.json() as unknown as WindowInfo[];
        return typeof body[0]?.ObjectID === 'number';
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] getWindowInfo failed for "${windowId}" — HTTP ${res.status}`);
    fail('getWindowInfo did not succeed');
  }

  return (res.json() as unknown as WindowInfo[])[0].ObjectID;
}

export function getListInitialData(token: string, version: string, screen: NavScreen, objectId: number) {
  const res = http.post(
    `${config.baseUrl}/api/GenericListServer/GetInitialData2`,
    JSON.stringify(listInitialDataPayload(screen, objectId)),
    { headers: buildHeaders(token, version), tags: { name: 'GetListInitialData' } },
  );

  const ok = check(res, {
    'GetListInitialData: status is 201': (r) => r.status === 201,
    'GetListInitialData: returns grid data': (r) => String(r.body ?? '').includes('TransportDataTables'),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] getListInitialData failed for "${screen.label}" (${screen.windowId}) — HTTP ${res.status}`);
    fail('getListInitialData did not succeed');
  }
}
