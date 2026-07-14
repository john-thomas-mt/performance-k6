import http from 'k6/http';
import { check } from 'k6';
import { config } from '../exports/config.exp.ts';
import { build_headers } from './headers.helper.ts';
import { ChromeRequest, StaticRequest } from '../exports/types.exp.ts';

type BatchReq = [string, string, string | null, { headers: { [header: string]: string }; tags: { name: string } }];

export function fire_ui_chrome(token: string, version: string, requests: ChromeRequest[]) {
  if (requests.length === 0) return;
  const headers = build_headers(token, version);
  const batch = requests.map((r): BatchReq => [
    r.method,
    `${config.baseUrl}${r.path}`,
    r.body ?? null,
    { headers, tags: { name: 'UIChrome' } },
  ]);

  const responses = Object.values(http.batch(batch));
  check(null, {
    'UIChrome: all requests responded': () => responses.every((r) => r.status > 0),
  });
}

export function fire_static_assets(requests: StaticRequest[]) {
  if (requests.length === 0) return;
  const headers = { accept: '*/*' };
  const batch = requests.map((r): BatchReq => ['GET', `${config.baseUrl}${r.path}`, null, { headers, tags: { name: 'StaticAsset' } }]);

  const responses = Object.values(http.batch(batch));
  check(null, {
    'StaticAsset: all requests responded': () => responses.every((r) => r.status > 0),
  });
}
