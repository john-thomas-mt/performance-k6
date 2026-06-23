import { User } from '../types/common.type.ts';

export function pickUser(users: ArrayLike<User>): User {
  if (__ENV.USER_MODE === 'single') return users[0];
  return users[__VU % users.length];
}
