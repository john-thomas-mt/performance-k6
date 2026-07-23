import http from 'k6/http';
import { check } from 'k6';
import { config } from '../exports/config.exp.ts';
import { build_headers } from './headers.helper.ts';
import { version_at_least } from './version.helper.ts';
import { ChromeRequest, StaticRequest } from '../exports/types.exp.ts';

type BatchReq = [string, string, string | null, { headers: { [header: string]: string }; tags: { name: string } }];

const apply_subs = (s: string, subs: { [token: string]: string }) =>
  s.replace(/\$\{([^}]+)\}/g, (m, key: string) => (key in subs ? subs[key] : m));

function fire_batch(token: string, version: string, pages: ChromeRequest[][], subs: { [token: string]: string }, tag: string) {
  if (pages.length === 0) return;
  const headers = build_headers(token, version);
  const statuses: number[] = [];
  const skipped: string[] = [];
  for (const page of pages) {
    const batch: BatchReq[] = [];
    for (const r of page) {
      if (r.removedIn !== undefined && version_at_least(version, r.removedIn)) continue;
      const path = apply_subs(r.path, subs);
      const body = r.body !== undefined ? apply_subs(r.body, subs) : null;
      if (/\$\{[^}]+\}/.test(path) || (body !== null && /\$\{[^}]+\}/.test(body))) {
        skipped.push(r.path);
        continue;
      }
      batch.push([r.method, `${config.baseUrl}${path}`, body, { headers, tags: { name: tag } }]);
    }
    if (batch.length === 0) continue;
    for (const resp of Object.values(http.batch(batch))) statuses.push(resp.status);
  }
  if (skipped.length)
    console.log(`[VU ${__VU}] ${tag} skipped ${skipped.length} with unresolved tokens: ${skipped.slice(0, 4).join(', ')}`);
  if (statuses.length === 0) return;
  check(null, {
    [`${tag}: all requests responded`]: () => statuses.every((s) => s > 0),
  });
}

export function fire_ui_chrome(token: string, version: string, requests: ChromeRequest[][], subs: { [token: string]: string } = {}) {
  fire_batch(token, version, requests, subs, 'UIChrome');
}

export function fire_transport(token: string, version: string, requests: ChromeRequest[][], subs: { [token: string]: string } = {}) {
  fire_batch(token, version, requests, subs, 'Transport');
}

export function fire_static_assets(pages: StaticRequest[][]) {
  if (pages.length === 0) return;
  const headers = { 'accept': '*/*', 'accept-encoding': 'gzip, deflate, br' };
  const statuses: number[] = [];
  for (const page of pages) {
    if (page.length === 0) continue;
    const batch = page.map((r): BatchReq => ['GET', `${config.baseUrl}${r.path}`, null, { headers, tags: { name: 'StaticAsset' } }]);
    for (const resp of Object.values(http.batch(batch))) statuses.push(resp.status);
  }
  if (statuses.length === 0) return;
  check(null, {
    'StaticAsset: all requests responded': () => statuses.every((s) => s > 0),
  });
}
