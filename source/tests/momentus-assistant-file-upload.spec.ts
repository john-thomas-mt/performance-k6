import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { loginToMomentusAssistant } from '../utils/exports/flows.exp.ts';
import { pickUser, fetchServerVersion } from '../utils/exports/helpers.exp.ts';
import { uploadOpportunityFile, pollForOpportunity } from '../utils/exports/apis.exp.ts';
import { loadProfile, commonThresholds } from '../utils/exports/config.exp.ts';
import { User, SetupData } from '../utils/exports/types.exp.ts';
import { users as userData } from '../utils/exports/data.exp.ts';

const users = new SharedArray<User>('users', () => userData);

const opportunityTemplate = open('../data/uploads/momentus-assistant/file-upload/sample-opportunity.txt');

export const options: Options = {
  ...loadProfile(),
  thresholds: {
    ...commonThresholds,
    'http_req_duration{name:FileUpload}': ['p(95)<5000'],
    checks: ['rate>0.95'],
  },
};

export function setup(): SetupData {
  if (users.length === 0) {
    throw new Error('data/users.ts is empty — add at least one user entry');
  }
  const version = fetchServerVersion();
  console.log(`Server version: ${version}`);
  console.log(`Test starting with ${users.length} user(s) in pool`);
  return { version };
}

export default function fileUploadTest(data: SetupData) {
  const user = pickUser(users);

  const runToken = crypto.randomUUID().split('-')[0];
  const uniqueContent = opportunityTemplate
    .replace('Performance', `Perf Event - ${runToken}`)
    .replace('michelle.venture.sales@nbevents.com', `michelle.venture.${runToken}@nbevents.com`);
  const filename = `opportunity-${runToken}.txt`;

  const { salesAiJwt } = loginToMomentusAssistant(user, data.version);
  if (!salesAiJwt) return;

  let traceId: string | undefined;

  group('3. Upload Opportunity File', () => {
    const result = uploadOpportunityFile(salesAiJwt, uniqueContent, filename);
    if (!result) return;
    traceId = result.traceId;
    console.log(`[VU ${__VU}] Upload accepted — traceId: ${traceId}, token: ${runToken}`);
  });

  if (!traceId) return;

  group('4. Verify Opportunity Created', () => {
    const found = pollForOpportunity(salesAiJwt, runToken);

    check(null, {
      'Opportunity appears in list after upload': () => found !== null,
    });
  });

  sleep(1);
}

export function teardown() {
  console.log('File upload test complete');
}
