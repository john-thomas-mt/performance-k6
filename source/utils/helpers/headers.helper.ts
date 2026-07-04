export function salesAiHeaders(salesAiJwt: string, contentType: string | null = null): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${salesAiJwt}`,
    accept: 'application/json, text/plain, */*',
  };
  if (contentType) headers['content-type'] = contentType;
  return headers;
}

export function buildHeaders(token: string | null, version: string): Record<string, string> {
  // __VU/__ITER are only defined inside a VU iteration; setup()/teardown() (e.g. the seed script's
  // login + createEvent) run outside one, so guard them — wsid is only a trace string.
  const vu = typeof __VU !== 'undefined' ? __VU : 0;
  const iter = typeof __ITER !== 'undefined' ? __ITER : 0;
  return {
    'authorization': token ? `Bearer ${token}` : 'Bearer',
    'clientappcategory': '10',
    'clientapptype': '2',
    'wsid': `k6-vu${vu}-iter${iter}`,
    'x-nonce': crypto.randomUUID(),
    'workstationname': 'k6-performance-test',
    'ucn': 'en-GB',
    'udf': 'dd/MM/yy',
    'utf': 'HH:mm',
    'utsf': 'HH:mm:ss',
    'utmf': 'HH:mm:ss.fff',
    'uldf': 'dd%20MMMM%20yyyy',
    'showactionid': 'false',
    version,
    'content-type': 'application/json',
    'accept': 'application/json',
  };
}
