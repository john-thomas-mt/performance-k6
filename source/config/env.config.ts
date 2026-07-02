type Site = 'QE' | 'AT' | 'RC' | 'PERF';

const setup = JSON.parse(open('../../temp/setup.json')) as Record<string, string>;
const secret = JSON.parse(open('../../temp/secret.json')) as Record<string, string>;

const site = (setup.site || 'AT') as Site;
const env = setup.env || '26_2';

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
  baseUrl: `https://${urlPrefix}.ungerboeck.${path}/${env}`,
  salesAiUrl,
  seedEventDesc: 'K6 Perf - Service Order Items Pool',
  cryptoKey: secret.key || '',
};
