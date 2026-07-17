import { check, group, fail } from 'k6';
import exec from 'k6/execution';
import { login_to_events } from './login.flow.ts';
import {
  open_report_master_list,
  read_report_master_grid,
  open_add_report_form,
  save_crystal_report,
  open_report_lists_search,
  read_report_lists_grid,
  get_report_list_window,
  open_report_list_superbox,
  save_report_list,
  open_org_source_search,
  read_org_source_grid,
  save_and_close_report,
  report_application_unloading,
  signalr_negotiate,
} from '../utils/exports/apis.exp.ts';
import {
  fidelity_level,
  include_ui,
  include_static,
  fire_ui_chrome,
  fire_static_assets,
  fire_transport,
  fetch_bundle_versions,
  think,
} from '../utils/exports/helpers.exp.ts';
import { crystalReportChrome, crystalReportStatic, crystalReportTransport } from '../utils/exports/data.exp.ts';
import { User, SetupData, ReportListContext, FidelityLevel } from '../utils/exports/types.exp.ts';

export const crystalReportThresholds = {
  'http_req_duration{name:OpenReportMasterList}': ['p(95)<3000'],
  'http_req_duration{name:ReadReportMasterGrid}': ['p(95)<3000'],
  'http_req_duration{name:OpenAddReportForm}': ['p(95)<5000'],
  'http_req_duration{name:SaveCrystalReport}': ['p(95)<10000'],
  'http_req_duration{name:OpenReportListsSearch}': ['p(95)<3000'],
  'http_req_duration{name:ReadReportListsGrid}': ['p(95)<3000'],
  'http_req_duration{name:GetReportListWindowInfo}': ['p(95)<3000'],
  'http_req_duration{name:OpenReportListSuperbox}': ['p(95)<5000'],
  'http_req_duration{name:SaveReportList}': ['p(95)<5000'],
  'http_req_duration{name:OpenOrgSourceSearch}': ['p(95)<3000'],
  'http_req_duration{name:ReadOrgSourceGrid}': ['p(95)<3000'],
  'http_req_duration{name:SaveAndCloseReport}': ['p(95)<3000'],
};

type Subs = { [token: string]: string };

function chrome_and_static(token: string, version: string, level: FidelityLevel, steps: string[], subs: Subs) {
  for (const step of steps) {
    if (include_ui(level)) fire_ui_chrome(token, version, crystalReportChrome[step] ?? [], subs);
    if (include_static(level)) {
      fire_static_assets(crystalReportStatic[step] ?? []);
      fire_transport(token, version, crystalReportTransport[step] ?? [], subs);
    }
  }
}

export function crystal_report_journey(user: User, data: SetupData) {
  const level = fidelity_level();
  const runToken = crypto.randomUUID().split('-')[0];
  const reportName = `k6 Crystal Report ${runToken}`;
  const reportId = `K${runToken}`.toUpperCase().slice(0, 10);

  const iter = exec.scenario.iterationInTest;
  const wdwBase = 9000000 + iter * 100;
  const detailWdwid = `SA${wdwBase}`;
  const editWdwid = `SA${wdwBase + 1}`;
  const superboxWdwid = `SA${wdwBase + 50}`;

  const subs: Subs = {
    'C_USI_Version': data.version,
    'C_EnterpriseVersion': data.version,
    'P_RPT_Id': reportId,
    'P_RPT_NAME': reportName,
    'P_CrystalReport_Scope.Value': 'X',
    'P_EpochTimestamp': String(Date.now()),
    'P_FormattedTimestamp': new Date().toISOString().slice(0, 19).replace('T', ' '),
    'P_IterationNumber': String(iter),
    'NL-VirtualUserId': String(__VU),
    'p_Name': runToken,
  };

  group('T30_CrystalReport_01_Launch', () => {
    if (include_static(level)) {
      const bundles = fetch_bundle_versions();
      subs.C_backOffice_version = bundles.backOffice;
      subs.C_css_version = bundles.css;
      subs.C_modernizr_version = bundles.modernizr;
      subs.C_english_version = bundles.english;
    }
    chrome_and_static('', data.version, level, ['01'], subs);
  });
  think();

  const { bearerToken, encUserId } = login_to_events(user, data.version, 'T30_CrystalReport_02_Login', (token, enc, sso) => {
    subs.C_UserId = token.split('|')[0];
    subs.C_EncID = enc;
    subs.C_TokenID = sso;
    if (include_static(level)) subs.C_ConnectionToken = signalr_negotiate(token, data.version);
    chrome_and_static(token, data.version, level, ['02'], subs);
  });
  think();

  group('T30_CrystalReport_03_Search_ReportMaster', () => {
    open_report_master_list(bearerToken, data.version);
    read_report_master_grid(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  group('T30_CrystalReport_04_ClickOn_AddReportMaster', () => {
    open_add_report_form(bearerToken, data.version, detailWdwid, editWdwid);
    chrome_and_static(bearerToken, data.version, level, ['04'], subs);
  });
  think();

  group('T30_CrystalReport_05_Fill_General_Details', () => {
    chrome_and_static(bearerToken, data.version, level, ['05'], subs);
  });
  think();

  let reportSeqRef: string | null = null;
  group('T30_CrystalReport_06_ApplyChanges_General_Details', () => {
    reportSeqRef = save_crystal_report(bearerToken, data.version, reportName, reportId, detailWdwid, editWdwid);
    console.log(`[VU ${__VU}] Created crystal report ${reportId} (seq ${reportSeqRef}) — ${reportName}`);
    subs.C_AddedRowKeys = reportSeqRef;
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  const reportSeq = reportSeqRef!;
  think();

  group('T30_CrystalReport_07_ClickOn_ReportLists', () => {
    open_report_lists_search(bearerToken, data.version, editWdwid, reportSeq);
    read_report_lists_grid(bearerToken, data.version, editWdwid, reportSeq);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();

  group('T30_CrystalReport_08_SelectAndSave_ReportLists', () => {
    const contextObjectId = get_report_list_window(bearerToken, data.version, superboxWdwid);
    const ctx: ReportListContext = {
      superboxWdwid,
      contextObjectId,
      encUserId,
      version: data.version,
      reportSeq,
      reportName,
      reportId,
    };
    const rows = open_report_list_superbox(bearerToken, data.version, ctx);
    const chosen = rows[0];
    if (!check(null, { 'Report list catalog returned rows': () => Boolean(chosen) })) {
      fail('no report-list rows returned');
    }
    save_report_list(bearerToken, data.version, ctx, chosen);
    subs.C_RPT_LIST = chosen.rptList;
    subs.C_RPT_LIST_DESC = chosen.desc;
    subs.C_RPT_ENT_STAMP = chosen.entStamp;
    chrome_and_static(bearerToken, data.version, level, ['08'], subs);
  });
  think();

  group('T30_CrystalReport_09_ClickOn_OrganizationReportSourceFiles', () => {
    open_org_source_search(bearerToken, data.version, editWdwid, reportSeq);
    read_org_source_grid(bearerToken, data.version, editWdwid, reportSeq);
    chrome_and_static(bearerToken, data.version, level, ['09'], subs);
  });
  think();

  group('T30_CrystalReport_10_ClickOn_Save&Close', () => {
    save_and_close_report(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['10'], subs);
  });
  think();

  group('T30_CrystalReport_11_LogOut', () => {
    report_application_unloading(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['11'], subs);
  });
  think();
}
