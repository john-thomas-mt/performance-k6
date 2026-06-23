import { config } from '../config/env.config.ts';

export function salesAiHeaders(
  salesAiJwt: string,
  contentType: string | null = null
): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${salesAiJwt}`,
    accept: 'application/json, text/plain, */*',
  };
  if (contentType) headers['content-type'] = contentType;
  return headers;
}

export function buildHeaders(token: string | null, version?: string): Record<string, string> {
  return {
    authorization: token ? `Bearer ${token}` : 'Bearer',
    clientappcategory: '10',
    clientapptype: '2',
    wsid: `k6-vu${__VU}-iter${__ITER}`,
    'x-nonce': crypto.randomUUID(),
    workstationname: 'k6-performance-test',
    ucn: 'en-GB',
    udf: 'dd/MM/yy',
    utf: 'HH:mm',
    utsf: 'HH:mm:ss',
    utmf: 'HH:mm:ss.fff',
    uldf: 'dd%20MMMM%20yyyy',
    showactionid: 'false',
    version: version || config.appVersion,
    'content-type': 'application/json',
    accept: 'application/json',
  };
}
