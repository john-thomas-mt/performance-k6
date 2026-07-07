import { group } from 'k6';
import { signIn, signInSession, maAuthenticate } from '../utils/exports/helpers.exp.ts';
import { User } from '../utils/exports/types.exp.ts';

export const loginThresholds = {
  'http_req_duration{name:SignIn}': ['p(95)<2000'],
  'http_req_duration{name:MAAuthenticate}': ['p(95)<2000'],
};

export function loginToMomentusAssistant(user: User, version: string) {
  let bearerToken: string | null = null;
  let salesAiJwt: string | null = null;

  group('1. Login', () => {
    bearerToken = signIn(user.username, user.password, version);
  });

  group('2. MA Authenticate', () => {
    salesAiJwt = maAuthenticate(bearerToken!, version);
  });

  return { bearerToken: bearerToken!, salesAiJwt: salesAiJwt! };
}

export function loginToEvents(user: User, version: string) {
  let bearerToken: string | null = null;
  let encUserId: string | null = null;

  group('1. Login', () => {
    ({ bearerToken, encUserId } = signInSession(user.username, user.password, version));
  });

  return { bearerToken: bearerToken!, encUserId: encUserId! };
}
