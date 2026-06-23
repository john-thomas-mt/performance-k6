import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Options } from 'k6/options';
import { loginToMomentusAssistant } from '../flows/login.flow.ts';
import { pickUser } from '../helpers/users.helper.ts';
import { uploadOpportunityFile } from '../apis/file-upload.api.ts';
import { pollForOpportunity } from '../apis/opportunities.api.ts';
import { fetchServerVersion } from '../helpers/version.helper.ts';
import { loadProfile, commonThresholds } from '../config/profiles.config.ts';
import { User, SetupData } from '../types/common.type.ts';
import { users as userData } from '../data/users.data.ts';

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
