import http from 'k6/http';
import { check } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text } from '../utils/exports/helpers.exp.ts';

export function signalr_negotiate(token: string, version: string, name = 'SignalRNegotiate') {
  const connectionData = encodeURIComponent('[{"name":"globalnavnotificationhub"}]');
  const res = http.get(`${config.baseUrl}/signalr/negotiate?clientProtocol=2.1&connectionData=${connectionData}&_=${Date.now()}`, {
    headers: build_headers(token, version),
    tags: { name },
  });
  const match = /"ConnectionToken":"([^"]*)"/.exec(body_text(res));
  check(res, { [`${name}: connectionToken present`]: () => match !== null });
  return match ? match[1] : '';
}
