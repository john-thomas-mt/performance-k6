import http from 'k6/http';
import { config } from '../exports/config.exp.ts';

export function fetchServerVersion(): string {
  const res = http.get(`${config.baseUrl}/app85.cshtml`);

  if (res.status !== 200) {
    console.warn(`fetchServerVersion: status ${res.status}, falling back to ${config.appVersion}`);
    return config.appVersion;
  }

  const match = String(res.body).match(/[?&]v=([\d.]+)/);
  if (!match) {
    console.warn(`fetchServerVersion: version not found in page, falling back to ${config.appVersion}`);
    return config.appVersion;
  }

  return match[1];
}
