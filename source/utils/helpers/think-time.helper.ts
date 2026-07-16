import { sleep } from 'k6';
import { Trend } from 'k6/metrics';

const thinkTimeTrend = new Trend('think_time', true);

export function think() {
  const seconds = 2 + Math.random();
  thinkTimeTrend.add(seconds * 1000);
  sleep(seconds);
}
