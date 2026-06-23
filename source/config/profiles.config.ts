import { Options } from 'k6/options';

type Profile = Pick<Options, 'vus' | 'iterations' | 'stages'>;

const profiles: Record<string, Profile> = {
  smoke: {
    vus: 1,
    iterations: 1,
  },
  load: {
    stages: [
      { duration: '30s', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '30s', target: 0 },
    ],
  },
  stress: {
    stages: [
      { duration: '1m', target: 10 },
      { duration: '2m', target: 20 },
      { duration: '1m', target: 0 },
    ],
  },
};

export function loadProfile(): Profile {
  const name = __ENV.PROFILE || 'smoke';
  const profile = profiles[name];
  if (!profile) {
    throw new Error(`Unknown PROFILE "${name}" — valid: ${Object.keys(profiles).join(', ')}`);
  }
  return profile;
}

export const commonThresholds: Record<string, string[]> = {
  http_req_failed: ['rate<0.05'],
};
