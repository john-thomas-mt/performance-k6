import { User } from '../exports/types.exp.ts';

export function pick_user(users: ArrayLike<User>): User {
  if (__ENV.USER_MODE === 'single') return users[0];
  return users[__VU % users.length];
}
