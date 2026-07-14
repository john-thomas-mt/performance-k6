import http from 'k6/http';
import { check, fail, JSONObject, JSONValue } from 'k6';
import encoding from 'k6/encoding';
import { config } from '../exports/config.exp.ts';
import { build_headers } from './headers.helper.ts';
import { body_text } from './response.helper.ts';
function post_sign_in(username: string, password: string, version: string) {
  const res = http.post(`${config.baseUrl}/api/GenericServer/SignIn`, JSON.stringify([username, password, '', false, '', '', [], '1']), {
    headers: build_headers(null, version),
    tags: { name: 'SignIn' },
  });

  const ok = check(res, {
    'SignIn: status is 201': (r) => r.status === 201,
    'SignIn: response is JSON': (r) => r.headers['Content-Type']?.includes('application/json') ?? false,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] sign_in failed for "${username}" — HTTP ${res.status}`);
    fail('sign_in did not succeed');
  }

  return res;
}

function extract_bearer_token(body: JSONValue) {
  return Array.isArray(body) ? (body.find((item): item is string => typeof item === 'string' && /^\d+\|/.test(item)) ?? null) : null;
}

function extract_encrypted_sn(body: JSONValue) {
  if (!Array.isArray(body)) return null;
  const item = body.find((e): e is JSONObject => !!e && typeof e === 'object' && !Array.isArray(e) && typeof e.EncryptedSN === 'string');
  return item ? (item.EncryptedSN as string) : null;
}

export function sign_in(username: string, password: string, version: string) {
  const res = post_sign_in(username, password, version);

  const token = extract_bearer_token(res.json());
  check(token, { 'SignIn: bearer token present': (t) => t !== null });
  if (!token) fail('sign_in: could not extract bearer token from response');

  return token;
}

export function sign_in_session(username: string, password: string, version: string) {
  const res = post_sign_in(username, password, version);

  const body = res.json();
  const bearerToken = extract_bearer_token(body);
  const encUserId = extract_encrypted_sn(body);

  check(bearerToken, { 'SignIn: bearer token present': (t) => t !== null });
  check(encUserId, { 'SignIn: encoded user id present': (e) => e !== null });
  if (!bearerToken) fail('sign_in_session: could not extract bearer token');
  if (!encUserId) fail('sign_in_session: could not extract EncryptedSN');

  return { bearerToken, encUserId };
}

export function ma_authenticate(bearerToken: string, version: string) {
  const res = http.post(`${config.baseUrl}/api/MomentusAssistantServer/Authenticate`, null, {
    headers: build_headers(bearerToken, version),
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
    console.error(`[VU ${__VU}] ma_authenticate failed — HTTP ${res.status}: ${body_text(res)}`);
    fail('ma_authenticate did not succeed');
  }

  return (res.json() as string[])[0];
}

export function sign_out(token: string, version: string, name = 'SignOut') {
  const res = http.get(`${config.baseUrl}/api/GenericServer/ApplicationUnloading`, {
    headers: build_headers(token, version),
    tags: { name },
  });
  check(res, { [`${name}: status is 200 or 201`]: (r) => r.status === 200 || r.status === 201 });
}

export function tenant_id_from_jwt(salesAiJwt: string) {
  const payload = encoding.b64decode(salesAiJwt.split('.')[1], 'rawurl', 's');
  const tenantId = (JSON.parse(payload) as { tenant_id?: string }).tenant_id;
  if (!tenantId) {
    throw new Error('tenant_id_from_jwt: tenant_id claim missing from sales-ai JWT');
  }
  return tenantId;
}
