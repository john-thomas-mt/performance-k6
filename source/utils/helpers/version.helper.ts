import http from 'k6/http';
import { config } from '../exports/config.exp.ts';
import { body_text } from './response.helper.ts';

export function fetch_server_version() {
  const res = http.get(`${config.baseUrl}/app85.cshtml`, {
    tags: { name: 'FetchServerVersion' },
  });

  if (res.status !== 200) {
    throw new Error(`fetch_server_version: GET app85.cshtml returned ${res.status}`);
  }

  const match = /[?&]v=([\d.]+)/.exec(body_text(res));
  if (!match) {
    throw new Error('fetch_server_version: version token (?v=) not found in app85.cshtml');
  }

  return match[1];
}

export function major_minor(version: string) {
  return version.split('.').slice(0, 2).join('.');
}
