import { b64decode } from 'k6/encoding';
import { ApiCredentials, User } from '../exports/types.exp.ts';

function string_to_array_buffer(str: string) {
  const buf = new ArrayBuffer(str.length * 2);
  const view = new Uint16Array(buf);
  for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
  return buf;
}

function array_buffer_to_string(buf: ArrayBuffer) {
  return String.fromCharCode(...new Uint16Array(buf));
}

async function derive_key(passphrase: string) {
  const digest = await crypto.subtle.digest('SHA-256', string_to_array_buffer(passphrase));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']);
}

async function decrypt_value(key: CryptoKey, encrypted: string) {
  const bytes = b64decode(encrypted);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return array_buffer_to_string(plaintext);
}

export async function decrypt_users(credentials: User[], passphrase: string) {
  const key = await derive_key(passphrase);

  const users: User[] = [];
  for (const { username, password } of credentials) {
    users.push({ username, password: await decrypt_value(key, password) });
  }

  return users;
}

const SEED_USERNAME = 'usiadmin';

export async function decrypt_seed_users(credentials: User[], passphrase: string) {
  const seedCredentials = credentials.filter((user) => user.username.toLowerCase() === SEED_USERNAME);
  if (seedCredentials.length === 0) {
    throw new Error(
      `No seed user — every seed signs in as ${SEED_USERNAME}: write temp/seed-users.json with an encrypted ${SEED_USERNAME} entry (rules/data.md)`,
    );
  }
  return decrypt_users(seedCredentials, passphrase);
}

export async function decrypt_api_credentials(credentials: ApiCredentials, passphrase: string) {
  const key = await derive_key(passphrase);
  return {
    userId: credentials.userId,
    key: await decrypt_value(key, credentials.key),
    secret: await decrypt_value(key, credentials.secret),
  };
}
