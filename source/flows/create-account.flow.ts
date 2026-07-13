import { check, group, sleep } from 'k6';
import { login_to_events } from './login.flow.ts';
import { open_account_create_form, create_account, search_accounts, open_account_detail } from '../utils/exports/apis.exp.ts';
import { User, SetupData, TransportTable } from '../utils/exports/types.exp.ts';

export const createAccountThresholds = {
  'http_req_duration{name:OpenAccountCreateForm}': ['p(95)<5000'],
  'http_req_duration{name:CreateAccount}': ['p(95)<5000'],
  'http_req_duration{name:SearchAccounts}': ['p(95)<3000'],
  'http_req_duration{name:OpenAccountDetail}': ['p(95)<5000'],
};

export function create_account_journey(user: User, data: SetupData) {
  const runToken = crypto.randomUUID().split('-')[0];
  const accountName = `Perf Test Account - ${runToken}`;

  const { bearerToken } = login_to_events(user, data.version);

  let formTableRef: TransportTable | null = null;
  group('3. Open Create Account Form', () => {
    formTableRef = open_account_create_form(bearerToken, data.version);
  });
  const formTable = formTableRef!;

  let newAcctCodeRef: string | null = null;
  group('4. Create Account', () => {
    newAcctCodeRef = create_account(bearerToken, data.version, formTable, accountName);
    console.log(`[VU ${__VU}] Created account ${newAcctCodeRef} — ${accountName}`);
  });
  const newAcctCode = newAcctCodeRef!;

  group('5. Confirm Account in List', () => {
    const rows = search_accounts(bearerToken, data.version, accountName);
    const match = rows.find((r) => r.name === accountName);
    check(null, {
      'New account appears in search': () => Boolean(match),
      'New account code matches saved code': () => Boolean(match && String(match.acctCode) === String(newAcctCode)),
    });
  });

  group('6. Open Account & Verify Details', () => {
    open_account_detail(bearerToken, data.version, newAcctCode, accountName);
  });

  sleep(1);
}
