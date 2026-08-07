/* Business identity for the booking (mirrors create_event so created data stays consistent). */
export const BOOKING_ACCOUNT = '00159220';
export const BOOKING_CONTACT = '00167764';

/* A distinct far-future date per iteration keeps concurrent VUs from contending on the same space/slot. */
export function random_future_date() {
  const year = new Date().getFullYear() + 5 + Math.floor(Math.random() * 20);
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}
