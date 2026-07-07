import { group, sleep } from 'k6';
import { loginToMomentusAssistant } from './login.flow.ts';
import { uploadOpportunityFile, pollForOpportunity } from '../utils/exports/apis.exp.ts';
import { User, SetupData } from '../utils/exports/types.exp.ts';

export const fileUploadThresholds = {
  'http_req_duration{name:FileUpload}': ['p(95)<5000'],
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (ms: number) => {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

export function fileUploadJourney(user: User, data: SetupData, template: string) {
  const runToken = crypto.randomUUID().split('-')[0];
  /* Uploads with overlapping event dates score as duplicates and get routed to Tasks, not
     opportunities — so each run needs a distinct future event date plus a unique company/contact. */
  const DAY = 24 * 60 * 60 * 1000;
  const evtStart = Date.UTC(2030, 0, 1) + (parseInt(runToken, 16) % 18000) * DAY;
  const uniqueContent = template
    .replaceAll('Performance', `Perf Event - ${runToken}`)
    .replaceAll('NB Events Global Inc.', `Perf Co ${runToken} Inc.`)
    .replaceAll('Venture', `V${runToken}`)
    .replace('michelle.venture.sales@nbevents.com', `michelle.v${runToken}@perfco-${runToken}.com`)
    .replace('Mar 14, 2030', fmtDate(evtStart - DAY))
    .replace('Mar 15, 2030', fmtDate(evtStart))
    .replace('Mar 16, 2030', fmtDate(evtStart + DAY))
    .replace('Mar 17.2030', fmtDate(evtStart + 2 * DAY));
  const filename = `opportunity-${runToken}.txt`;

  const { salesAiJwt } = loginToMomentusAssistant(user, data.version);

  group('3. Upload Opportunity File', () => {
    const result = uploadOpportunityFile(salesAiJwt, uniqueContent, filename);
    console.log(`[VU ${__VU}] Upload accepted — traceId: ${result.traceId}, token: ${runToken}`);
  });

  group('4. Verify Opportunity Created', () => {
    pollForOpportunity(salesAiJwt, runToken);
  });

  sleep(1);
}
