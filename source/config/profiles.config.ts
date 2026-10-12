import { Options } from 'k6/options';

type Profile = Pick<Options, 'vus' | 'iterations' | 'stages'>;

const profiles: { [profile: string]: Profile } = {
  'smoke': {
    vus: 1,
    iterations: 1,
  },
  'neoload': {
    stages: [
      { duration: '5m', target: 100 },
      { duration: '50m', target: 100 },
      { duration: '5m', target: 0 },
    ],
  },
  'neoload-smoke': {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '6m', target: 100 },
      { duration: '2m', target: 0 },
    ],
  },
};

export function load_profile(defaultName = 'smoke') {
  const name = __ENV.PROFILE || defaultName;
  const profile = profiles[name];
  if (!profile) {
    throw new Error(`Unknown PROFILE "${name}" — valid: ${Object.keys(profiles).join(', ')}`);
  }
  return profile;
}

export const commonThresholds = {
  http_req_failed: ['rate<0.05'],
};
