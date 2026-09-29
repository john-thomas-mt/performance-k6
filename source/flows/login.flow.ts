import { group } from 'k6';
import { sign_in_session } from '../utils/exports/helpers.exp.ts';
import { User } from '../utils/exports/types.exp.ts';

export const loginThresholds = {
  'http_req_duration{name:SignIn}': ['p(95)<2000'],
};

export function login_to_events(
  user: User,
  version: string,
  loginGroup = '1. Login',
  onAuthed?: (bearerToken: string, encUserId: string, ssoToken: string) => void,
) {
  let bearerToken: string | null = null;
  let encUserId: string | null = null;

  group(loginGroup, () => {
    const session = sign_in_session(user.username, user.password, version);
    bearerToken = session.bearerToken;
    encUserId = session.encUserId;
    if (onAuthed) onAuthed(session.bearerToken, session.encUserId, session.ssoToken);
  });

  return { bearerToken: bearerToken!, encUserId: encUserId! };
}
