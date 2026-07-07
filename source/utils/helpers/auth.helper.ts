import http from 'k6/http';
import { check, fail, JSONObject, JSONValue } from 'k6';
import encoding from 'k6/encoding';
import { config } from '../exports/config.exp.ts';
import { buildHeaders } from './headers.helper.ts';
function postSignIn(username: string, password: string, version: string) {
  const res = http.post(`${config.baseUrl}/api/GenericServer/SignIn`, JSON.stringify([username, password, '', false, '', '', [], '1']), {
    headers: buildHeaders(null, version),
    tags: { name: 'SignIn' },
  });

  const ok = check(res, {
    'SignIn: status is 201': (r) => r.status === 201,
    'SignIn: response is JSON': (r) => r.headers['Content-Type']?.includes('application/json') ?? false,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] signIn failed for "${username}" — HTTP ${res.status}`);
    fail('signIn did not succeed');
  }

  return res;
}

function extractBearerToken(body: JSONValue) {
  return Array.isArray(body) ? (body.find((item): item is string => typeof item === 'string' && /^\d+\|/.test(item)) ?? null) : null;
}

function extractEncryptedSN(body: JSONValue) {
  if (!Array.isArray(body)) return null;
  const item = body.find((e): e is JSONObject => !!e && typeof e === 'object' && !Array.isArray(e) && typeof e.EncryptedSN === 'string');
  return item ? (item.EncryptedSN as string) : null;
}

export function signIn(username: string, password: string, version: string) {
  const res = postSignIn(username, password, version);

  const token = extractBearerToken(res.json());
  check(token, { 'SignIn: bearer token present': (t) => t !== null });
  if (!token) fail('signIn: could not extract bearer token from response');

  return token;
}

export function signInSession(username: string, password: string, version: string) {
  const res = postSignIn(username, password, version);

  const body = res.json();
  const bearerToken = extractBearerToken(body);
  const encUserId = extractEncryptedSN(body);

  check(bearerToken, { 'SignIn: bearer token present': (t) => t !== null });
  check(encUserId, { 'SignIn: encoded user id present': (e) => e !== null });
  if (!bearerToken) fail('signInSession: could not extract bearer token');
  if (!encUserId) fail('signInSession: could not extract EncryptedSN');

  return { bearerToken, encUserId };
}

export function maAuthenticate(bearerToken: string, version: string) {
  const res = http.post(`${config.baseUrl}/api/MomentusAssistantServer/Authenticate`, null, {
    headers: buildHeaders(bearerToken, version),
    tags: { name: 'MAAuthenticate' },
  });

  const ok = check(res, {
    'MAAuthenticate: status is 201': (r) => r.status === 201,
    'MAAuthenticate: returns JWT array': (r) => {
      try {
        const body = r.json();
        return Array.isArray(body) && body.length > 0 && typeof body[0] === 'string';
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] maAuthenticate failed — HTTP ${res.status}: ${res.body}`);
    fail('maAuthenticate did not succeed');
  }

  return (res.json() as string[])[0];
}

export function tenantIdFromJwt(salesAiJwt: string) {
  const payload = encoding.b64decode(salesAiJwt.split('.')[1], 'rawurl', 's');
  const tenantId = (JSON.parse(payload) as { tenant_id?: string }).tenant_id;
  if (!tenantId) {
    throw new Error('tenantIdFromJwt: tenant_id claim missing from sales-ai JWT');
  }
  return tenantId;
}
