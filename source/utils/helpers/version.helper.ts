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

export function fetch_bundle_versions() {
  const res = http.get(`${config.baseUrl}/app85.cshtml`, { tags: { name: 'AppShell' } });
  const html = body_text(res);
  const grab = (marker: string) => {
    const idx = html.indexOf(marker);
    if (idx < 0) return '';
    const rest = html.slice(idx + marker.length);
    const end = rest.search(/["&]/);
    return end < 0 ? '' : rest.slice(0, end);
  };
  return {
    backOffice: grab('Content/css/backOffice?v='),
    css: grab('/Content/css?v='),
    modernizr: grab('scripts/modernizr?v='),
    english: grab('wijmo/controls/cultures/english?v='),
  };
}

export function version_at_least(version: string, target: string) {
  const [maj, min] = major_minor(version).split('.').map(Number);
  const [targetMaj, targetMin] = target.split('.').map(Number);
  return maj > targetMaj || (maj === targetMaj && min >= targetMin);
}
