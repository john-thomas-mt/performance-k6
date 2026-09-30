import { group } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  get_lead_column_stamp,
  open_leads_list,
  read_leads_grid,
  open_lead_create_form,
  refresh_lead_company_fields,
  refresh_lead_contact_fields,
  search_lead_source,
  search_account_rep,
  save_recent_account_rep,
  save_lead,
  open_lead_detail,
  convert_lead_to_account,
  read_convert_results_grid,
  read_lead_contacts_grid,
  open_lead_contacts_search,
  open_leads_view_list,
  read_leads_view_grid,
} from '../utils/exports/apis.exp.ts';
import { fetch_bundle_versions, fidelity_level, include_static, pick_pool_value, sign_out, think } from '../utils/exports/helpers.exp.ts';
import { leadAccount } from '../utils/exports/data.exp.ts';
import { LeadFormSession, SetupData, User } from '../utils/exports/types.exp.ts';

const ACCOUNT_REP_NAME = 'ADMIN USI';

export const leadAccountThresholds = {
  'http_req_duration{name:GetLeadObjectColumns}': ['avg<4000'],
  'http_req_duration{name:OpenLeadsList}': ['avg<4000'],
  'http_req_duration{name:ReadLeadsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenLeadCreateForm}': ['avg<4000'],
  'http_req_duration{name:HandleLeadCompanyFields}': ['avg<4000'],
  'http_req_duration{name:HandleLeadContactFields}': ['avg<4000'],
  'http_req_duration{name:SearchLeadSource}': ['avg<4000'],
  'http_req_duration{name:SearchAccountRep}': ['avg<4000'],
  'http_req_duration{name:SaveRecentAccountRep}': ['avg<4000'],
  'http_req_duration{name:SaveLead}': ['avg<4000'],
  'http_req_duration{name:OpenLeadDetail}': ['avg<4000'],
  'http_req_duration{name:ConvertLeadToAccount}': ['avg<4000'],
  'http_req_duration{name:ReadConvertResultsGrid}': ['avg<4000'],
  'http_req_duration{name:RefreshLeadDetail}': ['avg<4000'],
  'http_req_duration{name:ReadLeadContactsGrid}': ['avg<4000'],
  'http_req_duration{name:OpenLeadContactsSearch}': ['avg<4000'],
  'http_req_duration{name:OpenLeadsViewList}': ['avg<4000'],
  'http_req_duration{name:ReadLeadsViewGrid}': ['avg<4000'],
};

export function lead_account_journey(user: User, data: SetupData) {
  const iter = exec.scenario.iterationInTest;
  const runToken = `${__VU}${iter}${Date.now()}`;
  const wdwBase = 8000000 + iter * 10;
  const listWdwid = `OA${wdwBase}`;
  const resultsWdwid = `OA${wdwBase + 3}`;
  const companyName = `Comp_${runToken}`;
  const lastName = `Account${runToken}`;
  const leadSourceCode = pick_pool_value(leadAccount);

  group('T001_AccountCreation_01_Launch', () => {
    if (include_static(fidelity_level())) fetch_bundle_versions();
  });
  think();

  const { bearerToken } = login_to_events(user, data.version, 'T001_AccountCreation_02_Login');
  think();

  let columnStamp = '';
  group('T001_AccountCreation_03_SearchLeads', () => {
    columnStamp = get_lead_column_stamp(bearerToken, data.version);
    open_leads_list(bearerToken, data.version, listWdwid);
    read_leads_grid(bearerToken, data.version, listWdwid);
  });
  think();

  const session: LeadFormSession = {
    formWdwid: `OA${wdwBase + 1}`,
    editWdwid: `OA${wdwBase + 2}`,
    layoutId: '',
    tableName: String(Date.now()),
  };
  group('T001_AccountCreation_04_ClickAddButton', () => {
    session.layoutId = open_lead_create_form(bearerToken, data.version, session.formWdwid, session.editWdwid, columnStamp);
  });
  think();

  let leadId = '';
  group('T001_AccountCreation_05_ClickSaveButton', () => {
    refresh_lead_company_fields(bearerToken, data.version, session, companyName);
    refresh_lead_contact_fields(bearerToken, data.version, session, companyName, lastName);
    const leadSource = search_lead_source(bearerToken, data.version, leadSourceCode);
    const accountRep = search_account_rep(bearerToken, data.version, ACCOUNT_REP_NAME);
    save_recent_account_rep(bearerToken, data.version, accountRep);
    leadId = save_lead(bearerToken, data.version, session, {
      companyName,
      lastName,
      leadSource,
      accountRep,
      email: `K6Lead${runToken}@pt.com`,
      phone: `${11111 + Math.floor(Math.random() * 88889)}${String(Date.now()).slice(-5)}`,
    });
    console.log(`[VU ${__VU}] Created lead ${leadId} — ${companyName}`);
    open_lead_detail(bearerToken, data.version, session.editWdwid, leadId, columnStamp);
  });
  think();

  group('T001_AccountCreation_06_ClickConvert', () => {
    convert_lead_to_account(bearerToken, data.version, session.editWdwid, leadId);
    read_convert_results_grid(bearerToken, data.version, resultsWdwid);
    open_lead_detail(bearerToken, data.version, session.editWdwid, leadId, columnStamp, 'RefreshLeadDetail');
    read_lead_contacts_grid(bearerToken, data.version, session.editWdwid, leadId);
    open_lead_contacts_search(bearerToken, data.version, session.editWdwid, leadId);
    console.log(`[VU ${__VU}] Converted lead ${leadId} to an account`);
  });
  think();

  group('T001_AccountCreation_07_ClickSaveButton', () => {
    open_leads_view_list(bearerToken, data.version, listWdwid);
    read_leads_view_grid(bearerToken, data.version, listWdwid);
  });
  think();

  group('T001_AccountCreation_08_SignOut', () => {
    sign_out(bearerToken, data.version);
  });
  think();
}
