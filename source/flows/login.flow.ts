import { group } from 'k6';
import { signIn, signInSession, maAuthenticate } from '../utils/exports/helpers.exp.ts';
import { User, MomentusAuth, SessionTokens } from '../utils/exports/types.exp.ts';

export const loginThresholds: Record<string, string[]> = {
  'http_req_duration{name:SignIn}': ['p(95)<2000'],
  'http_req_duration{name:MAAuthenticate}': ['p(95)<2000'],
};

export function loginToMomentusAssistant(user: User, version: string): MomentusAuth {
  let bearerToken: string | null = null;
  let salesAiJwt: string | null = null;

  group('1. Login', () => {
    bearerToken = signIn(user.username, user.password, version);
  });

  if (!bearerToken) return { bearerToken, salesAiJwt };

  group('2. MA Authenticate', () => {
    salesAiJwt = maAuthenticate(bearerToken!, version);
  });

  return { bearerToken, salesAiJwt };
}

export function loginToEvents(user: User, version: string): SessionTokens {
  let bearerToken: string | null = null;
  let encUserId: string | null = null;

  group('1. Login', () => {
    ({ bearerToken, encUserId } = signInSession(user.username, user.password, version));
  });

  return { bearerToken, encUserId };
}
