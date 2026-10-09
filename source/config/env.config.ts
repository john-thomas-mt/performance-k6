import type { Site, ReleaseVersion, User } from '../utils/exports/types.exp.ts';

const setup = JSON.parse(open('../../temp/setup.json')) as { [setting: string]: string };
const secret = JSON.parse(open('../../temp/secret.json')) as { [setting: string]: string };

function read_seed_users() {
  try {
    return JSON.parse(open('../../temp/seed-users.json')) as User[];
  } catch {
    return [];
  }
}

const site = (setup.site || 'PERF') as Site;
const env = (setup.env || 'main') as ReleaseVersion;

let urlPrefix: string;
let path: string;
let salesAiUrl: string;
if (site === 'QE') {
  urlPrefix = 'qe';
  path = 'com';
  salesAiUrl = 'https://momentus-sales-ai-dev.ungerboeck.net';
} else if (site === 'RC') {
  urlPrefix = 'releasecandidate';
  path = 'com';
  salesAiUrl = 'https://momentus-sales-ai-dev.ungerboeck.net';
} else if (site === 'AT') {
  urlPrefix = 'qe';
  path = 'com/AutomatedUITesting';
  salesAiUrl = 'https://momentus-sales-ai-dev.ungerboeck.net';
} else if (site === 'PERF') {
  urlPrefix = 'performance';
  path = 'net';
  salesAiUrl = 'https://momentus-agents-us.ungerboeck.net';
} else {
  throw new Error(`Unknown site: ${site}. Expected 'QE', 'AT', 'RC', or 'PERF'.`);
}

export const config = {
  env,
  baseUrl: `https://${urlPrefix}.ungerboeck.${path}/${env}`,
  salesAiUrl,
  seedEventPrefix: 'k6-t34-booking-event',
  seedInvoiceEventPrefix: 'k6-t8-booking-event',
  seedVoucherPrefix: 'k6-t10-purchase-order',
  seedPaymentPlanPrefix: 'k6-t11-booking-event',
  seedCopyPasteFunctionPrefix: 'k6-t16-booking-event',
  seedCopyPasteFunctionDescPrefix: 'k6-t16-function',
  cryptoKey: secret.key || '',
  seedUsers: read_seed_users(),
};
