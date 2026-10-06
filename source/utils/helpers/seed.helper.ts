import { config } from '../exports/config.exp.ts';

export function seed_gap_message(journey: string, detail: string) {
  return `no seed data (${detail}): run /seed ${config.env} ${journey}`;
}
