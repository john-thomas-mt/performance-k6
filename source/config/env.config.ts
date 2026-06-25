type Site = 'QE' | 'AT' | 'RC';

function baseUrlFor(site: Site, env: string): string {
  switch (site) {
    case 'QE':
      return `https://qe.ungerboeck.com/${env}`;
    case 'RC':
      return `https://releasecandidate.ungerboeck.com/${env}`;
    case 'AT':
    default:
      return `https://qe.ungerboeck.com/AutomatedUITesting/${env}`;
  }
}

let setup: Record<string, string> = {};
try {
  setup = JSON.parse(open('../../temp/setup.json'));
} catch {
  setup = {};
}

let secret: Record<string, string> = {};
try {
  secret = JSON.parse(open('../../temp/secret.json'));
} catch {
  secret = {};
}

const site = (__ENV.SITE || setup.site || 'AT') as Site;
const env = __ENV.ENV || setup.env || '26_2';

export const config = {
  baseUrl: __ENV.BASE_URL || baseUrlFor(site, env),
  salesAiUrl: __ENV.SALES_AI_URL || 'https://momentus-sales-ai-dev.ungerboeck.net',
  tenantId: __ENV.TENANT_ID || 'QESampleAutomatedUITesting262',
  appVersion: __ENV.APP_VERSION || '26.2.9634.31065',
  // Marker description for the seeded service-order pool — shared by the seed script
  // (source/seeds/service-orders.seed.ts) and the consuming test for discovery-by-search.
  seedEventDesc: __ENV.SEED_EVENT_DESC || 'PerfSeed Service Order Pool',
  // Passphrase that decrypts the committed user pool: -e CRYPTO_KEY wins, else temp/secret.json.
  cryptoKey: __ENV.CRYPTO_KEY || secret.key || '',
};
