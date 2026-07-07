import { b64decode } from 'k6/encoding';
import { User } from '../exports/types.exp.ts';

function stringToArrayBuffer(str: string) {
  const buf = new ArrayBuffer(str.length * 2);
  const view = new Uint16Array(buf);
  for (let i = 0; i < str.length; i++) view[i] = str.charCodeAt(i);
  return buf;
}

function arrayBufferToString(buf: ArrayBuffer) {
  return String.fromCharCode(...new Uint16Array(buf));
}

async function deriveKey(passphrase: string) {
  const digest = await crypto.subtle.digest('SHA-256', stringToArrayBuffer(passphrase));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt']);
}

export async function decryptUsers(credentials: User[], passphrase: string) {
  const key = await deriveKey(passphrase);

  const users: User[] = [];
  for (const { username, password } of credentials) {
    const bytes = b64decode(password);
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    users.push({ username, password: arrayBufferToString(plaintext) });
  }

  return users;
}
