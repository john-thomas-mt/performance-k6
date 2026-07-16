import { sleep } from 'k6';

export function pace(seconds: number, iteration: () => void) {
  const start = Date.now();
  iteration();
  const remaining = seconds - (Date.now() - start) / 1000;
  if (remaining > 0) sleep(remaining);
}
