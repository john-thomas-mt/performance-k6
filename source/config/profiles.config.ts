import { Options } from 'k6/options';

type Profile = Pick<Options, 'vus' | 'iterations' | 'stages'>;

const profiles: { [profile: string]: Profile } = {
  smoke: {
    vus: 1,
    iterations: 1,
  },
  neoload: {
    stages: [
      { duration: '5m', target: 10 },
      { duration: '35m', target: 10 },
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
