import http from 'k6/http';
import { config } from '../exports/config.exp.ts';

export function fetchServerVersion(): string {
  const res = http.get(`${config.baseUrl}/app85.cshtml`, {
    tags: { name: 'FetchServerVersion' },
  });

  if (res.status !== 200) {
    throw new Error(`fetchServerVersion: GET app85.cshtml returned ${res.status}`);
  }

  const match = String(res.body).match(/[?&]v=([\d.]+)/);
  if (!match) {
    throw new Error('fetchServerVersion: version token (?v=) not found in app85.cshtml');
  }

  return match[1];
}
