import http from 'k6/http';
import { config } from '../exports/config.exp.ts';
import { bodyText } from './response.helper.ts';

export function fetchServerVersion() {
  const res = http.get(`${config.baseUrl}/app85.cshtml`, {
    tags: { name: 'FetchServerVersion' },
  });

  if (res.status !== 200) {
    throw new Error(`fetchServerVersion: GET app85.cshtml returned ${res.status}`);
  }

  const match = /[?&]v=([\d.]+)/.exec(bodyText(res));
  if (!match) {
    throw new Error('fetchServerVersion: version token (?v=) not found in app85.cshtml');
  }

  return match[1];
}

export function majorMinor(version: string) {
  return version.split('.').slice(0, 2).join('.');
}
