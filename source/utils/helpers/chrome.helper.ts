import http from 'k6/http';
import { check } from 'k6';
import { config } from '../exports/config.exp.ts';
import { build_headers } from './headers.helper.ts';
import { version_at_least } from './version.helper.ts';
import { ChromeRequest, StaticRequest } from '../exports/types.exp.ts';

type BatchReq = [string, string, string | null, { headers: { [header: string]: string }; tags: { name: string } }];

const apply_subs = (s: string, subs: { [token: string]: string }) =>
  s.replace(/\$\{([^}]+)\}/g, (m, key: string) => (key in subs ? subs[key] : m));

function fire_batch(token: string, version: string, requests: ChromeRequest[], subs: { [token: string]: string }, tag: string) {
  if (requests.length === 0) return;
  const headers = build_headers(token, version);
  const batch: BatchReq[] = [];
  const skipped: string[] = [];
  for (const r of requests) {
    if (r.removedIn !== undefined && version_at_least(version, r.removedIn)) continue;
    const path = apply_subs(r.path, subs);
    const body = r.body !== undefined ? apply_subs(r.body, subs) : null;
    if (/\$\{[^}]+\}/.test(path) || (body !== null && /\$\{[^}]+\}/.test(body))) {
      skipped.push(r.path);
      continue;
    }
    batch.push([r.method, `${config.baseUrl}${path}`, body, { headers, tags: { name: tag } }]);
  }
  if (skipped.length)
    console.log(`[VU ${__VU}] ${tag} skipped ${skipped.length} with unresolved tokens: ${skipped.slice(0, 4).join(', ')}`);
  if (batch.length === 0) return;

  const responses = Object.values(http.batch(batch));
  check(null, {
    [`${tag}: all requests responded`]: () => responses.every((r) => r.status > 0),
  });
}

export function fire_ui_chrome(token: string, version: string, requests: ChromeRequest[], subs: { [token: string]: string } = {}) {
  fire_batch(token, version, requests, subs, 'UIChrome');
}

export function fire_transport(token: string, version: string, requests: ChromeRequest[], subs: { [token: string]: string } = {}) {
  fire_batch(token, version, requests, subs, 'Transport');
}

export function fire_static_assets(requests: StaticRequest[]) {
  if (requests.length === 0) return;
  const headers = { 'accept': '*/*', 'accept-encoding': 'gzip, deflate, br' };
  const batch = requests.map((r): BatchReq => ['GET', `${config.baseUrl}${r.path}`, null, { headers, tags: { name: 'StaticAsset' } }]);

  const responses = Object.values(http.batch(batch));
  check(null, {
    'StaticAsset: all requests responded': () => responses.every((r) => r.status > 0),
  });
}
