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
  signalr_negotiate,
} from '../utils/exports/apis.exp.ts';
import {
  fetch_bundle_versions,
  fidelity_level,
  fire_static_assets,
  fire_transport,
  fire_ui_chrome,
  include_static,
  include_ui,
  pick_pool_value,
  sign_out,
  think,
} from '../utils/exports/helpers.exp.ts';
import { leadAccount, leadAccountChrome, leadAccountStatic, leadAccountTransport } from '../utils/exports/data.exp.ts';
import { FidelityLevel, LeadFormSession, SetupData, User } from '../utils/exports/types.exp.ts';

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

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, step: string, subs: Subs) {
  if (include_ui(level)) fire_ui_chrome(token, version, leadAccountChrome[step] ?? [], subs);
  if (include_static(level)) {
    fire_static_assets(leadAccountStatic[step] ?? []);
    fire_transport(token, version, leadAccountTransport[step] ?? [], subs);
  }
}

export function lead_account_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const subs: Subs = { P_EpochTimestamp: String(Date.now()) };
  const iter = exec.scenario.iterationInTest;
  const runToken = `${__VU}${iter}${Date.now()}`;
  const wdwBase = 8000000 + iter * 10;
  const listWdwid = `OA${wdwBase}`;
  const resultsWdwid = `OA${wdwBase + 3}`;
  const companyName = `k6-t1-company-${runToken}`;
  const lastName = `k6-t1-account-${runToken}`;
  const leadSourceCode = pick_pool_value(leadAccount);

  group('T001_AccountCreation_01_Launch', () => {
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
    }
    chrome_and_static('', data.version, level, '01', subs);
  });
  think();

  const { bearerToken } = login_to_events(user, data.version, 'T001_AccountCreation_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, '02', subs);
  });
  think();

  let columnStamp = '';
  group('T001_AccountCreation_03_SearchLeads', () => {
    columnStamp = get_lead_column_stamp(bearerToken, data.version);
    open_leads_list(bearerToken, data.version, listWdwid);
    read_leads_grid(bearerToken, data.version, listWdwid);
    subs.C_SearchLeads_Timestamp1 = columnStamp;
    chrome_and_static(bearerToken, data.version, level, '03', subs);
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
    chrome_and_static(bearerToken, data.version, level, '04', subs);
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
      email: `k6-t1-lead-${runToken}@pt.com`,
      phone: `${11111 + Math.floor(Math.random() * 88889)}${String(Date.now()).slice(-5)}`,
    });
    console.log(`[VU ${__VU}] Created lead ${leadId} — ${companyName}`);
    open_lead_detail(bearerToken, data.version, session.editWdwid, leadId, columnStamp);
    subs.C_LEAD_ID = leadId;
    chrome_and_static(bearerToken, data.version, level, '05', subs);
  });
  think();

  group('T001_AccountCreation_06_ClickConvert', () => {
    convert_lead_to_account(bearerToken, data.version, session.editWdwid, leadId);
    read_convert_results_grid(bearerToken, data.version, resultsWdwid);
    open_lead_detail(bearerToken, data.version, session.editWdwid, leadId, columnStamp, 'RefreshLeadDetail');
    read_lead_contacts_grid(bearerToken, data.version, session.editWdwid, leadId);
    open_lead_contacts_search(bearerToken, data.version, session.editWdwid, leadId);
    console.log(`[VU ${__VU}] Converted lead ${leadId} to an account`);
    chrome_and_static(bearerToken, data.version, level, '06', subs);
  });
  think();

  group('T001_AccountCreation_07_ClickSaveButton', () => {
    open_leads_view_list(bearerToken, data.version, listWdwid);
    read_leads_view_grid(bearerToken, data.version, listWdwid);
    chrome_and_static(bearerToken, data.version, level, '07', subs);
  });
  think();

  group('T001_AccountCreation_08_SignOut', () => {
    sign_out(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, '08', subs);
  });
  think();
}
