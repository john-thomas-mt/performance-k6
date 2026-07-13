import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, parse_grid_rows, initial_data_table } from '../utils/exports/helpers.exp.ts';
import { accountCreateFormPayload, accountSavePayload, accountSearchPayload, accountDetailPayload } from '../utils/exports/data.exp.ts';
import { AccountRow, AccountSaveResult, TransportTable } from '../utils/exports/types.exp.ts';

export function open_account_create_form(token: string, version: string, name = 'OpenAccountCreateForm'): TransportTable {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(accountCreateFormPayload()), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_account_create_form failed — HTTP ${res.status}`);
    fail('open_account_create_form did not succeed');
  }

  return initial_data_table(res, name);
}

export function create_account(token: string, version: string, table: TransportTable, accountName: string, name = 'CreateAccount') {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/Save2`, JSON.stringify(accountSavePayload(table, accountName)), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
    [`${name}: ResultValue is 0 (success)`]: (r) => {
      try {
        return (r.json() as AccountSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    [`${name}: returns new account row key`]: (r) => {
      try {
        const k = (r.json() as AccountSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] create_account failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail('create_account did not succeed');
  }

  const addedKey = (res.json() as AccountSaveResult[])[0].AddedRowKeys[0];
  return addedKey.split('|')[1];
}

export function search_accounts(token: string, version: string, searchValue: string, name = 'SearchAccounts'): AccountRow[] {
  const res = http.post(`${config.baseUrl}/api/USIDataGridServer/GetGridData2`, JSON.stringify(accountSearchPayload(searchValue)), {
    headers: build_headers(token, version),
    tags: { name },
  });

  const ok = check(res, {
    [`${name}: status is 201`]: (r) => r.status === 201,
  });

  if (!ok) {
    console.error(`[VU ${__VU}] search_accounts failed — HTTP ${res.status}`);
    return [];
  }

  return parse_grid_rows(
    res,
    {
      name: 'EV870_NAME',
      acctCode: 'EV870_ACCT_CODE',
      rowKey: 'cROW_KEY',
    },
    name,
  );
}

export function open_account_detail(token: string, version: string, acctCode: string, expectedName: string) {
  const res = http.post(`${config.baseUrl}/api/GenericDetailServer/GetInitialData2`, JSON.stringify(accountDetailPayload(acctCode)), {
    headers: build_headers(token, version),
    tags: { name: 'OpenAccountDetail' },
  });

  const ok = check(res, {
    'OpenAccountDetail: status is 201': (r) => r.status === 201,
    'OpenAccountDetail: detail shows account name': (r) => body_text(r).includes(expectedName),
  });

  if (!ok) {
    console.error(`[VU ${__VU}] open_account_detail failed — HTTP ${res.status}`);
    fail('open_account_detail did not succeed');
  }
}
