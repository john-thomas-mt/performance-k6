type Site = 'QE' | 'AT' | 'RC';

const setup = JSON.parse(open('../../temp/setup.json')) as Record<string, string>;
const secret = JSON.parse(open('../../temp/secret.json')) as Record<string, string>;

const site = (setup.site || 'AT') as Site;
const env = setup.env || '26_2';

let urlPrefix: string;
let path: string;
if (site === 'QE') {
  urlPrefix = 'qe';
  path = 'com';
} else if (site === 'RC') {
  urlPrefix = 'releasecandidate';
  path = 'com';
} else if (site === 'AT') {
  urlPrefix = 'qe';
  path = 'com/AutomatedUITesting';
} else {
  throw new Error(`Unknown site: ${site}. Expected 'QE', 'AT', or 'RC'.`);
}

export const config = {
  baseUrl: `https://${urlPrefix}.ungerboeck.${path}/${env}`,
  salesAiUrl: 'https://momentus-sales-ai-dev.ungerboeck.net',
  seedEventDesc: 'PerfSeed Service Order Pool',
  cryptoKey: secret.key || '',
};
