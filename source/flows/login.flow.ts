import { group } from 'k6';
import { sign_in, sign_in_session, ma_authenticate } from '../utils/exports/helpers.exp.ts';
import { User } from '../utils/exports/types.exp.ts';

export const loginThresholds = {
  'http_req_duration{name:SignIn}': ['p(95)<2000'],
  'http_req_duration{name:MAAuthenticate}': ['p(95)<2000'],
};

export function login_to_momentus_assistant(user: User, version: string) {
  let bearerToken: string | null = null;
  let salesAiJwt: string | null = null;

  group('1. Login', () => {
    bearerToken = sign_in(user.username, user.password, version);
  });

  group('2. MA Authenticate', () => {
    salesAiJwt = ma_authenticate(bearerToken!, version);
  });

  return { bearerToken: bearerToken!, salesAiJwt: salesAiJwt! };
}

export function login_to_events(user: User, version: string) {
  let bearerToken: string | null = null;
  let encUserId: string | null = null;

  group('1. Login', () => {
    ({ bearerToken, encUserId } = sign_in_session(user.username, user.password, version));
  });

  return { bearerToken: bearerToken!, encUserId: encUserId! };
}
