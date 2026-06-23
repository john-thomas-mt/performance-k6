import { group } from 'k6';
import { signIn, signInSession, maAuthenticate } from '../helpers/auth.helper.ts';
import { User, MomentusAuth, SessionTokens } from '../types/common.type.ts';

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
