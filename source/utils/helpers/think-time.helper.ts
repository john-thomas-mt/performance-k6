import { sleep } from 'k6';

export function think(seconds: number) {
  if (__ENV.THINK_TIME === 'neoload') sleep(seconds);
}
