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
} from '../utils/exports/apis.exp.ts';
import { fidelity_level, include_ui, include_static, fire_ui_chrome, fire_static_assets, think } from '../utils/exports/helpers.exp.ts';
import { crystalReportChrome, crystalReportStatic } from '../utils/exports/data.exp.ts';
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
    if (include_static(level)) fire_static_assets(crystalReportStatic[step] ?? []);
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

  const { bearerToken, encUserId } = login_to_events(user, data.version);

  const subs: Subs = {
    'C_USI_Version': data.version,
    'C_EnterpriseVersion': data.version,
    'C_EncID': encUserId,
    'C_UserId': bearerToken.split('|')[0],
    'P_RPT_Id': reportId,
    'P_RPT_NAME': reportName,
    'P_CrystalReport_Scope.Value': 'X',
    'P_EpochTimestamp': String(Date.now()),
    'P_FormattedTimestamp': new Date().toISOString().slice(0, 19).replace('T', ' '),
    'P_IterationNumber': String(iter),
    'NL-VirtualUserId': String(__VU),
    'p_Name': runToken,
  };
  chrome_and_static(bearerToken, data.version, level, ['01', '02'], subs);
  think();

  group('3. Open Report Master List', () => {
    open_report_master_list(bearerToken, data.version);
    read_report_master_grid(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['03'], subs);
  });
  think();

  group('4. Open Add Report Master', () => {
    open_add_report_form(bearerToken, data.version, detailWdwid, editWdwid);
    chrome_and_static(bearerToken, data.version, level, ['04', '05'], subs);
  });
  think();

  let reportSeqRef: string | null = null;
  group('5. Save Report Master', () => {
    reportSeqRef = save_crystal_report(bearerToken, data.version, reportName, reportId, detailWdwid, editWdwid);
    console.log(`[VU ${__VU}] Created crystal report ${reportId} (seq ${reportSeqRef}) — ${reportName}`);
    subs.C_AddedRowKeys = reportSeqRef;
    chrome_and_static(bearerToken, data.version, level, ['06'], subs);
  });
  const reportSeq = reportSeqRef!;
  think();

  group('6. Open Report Lists Section', () => {
    open_report_lists_search(bearerToken, data.version, editWdwid, reportSeq);
    read_report_lists_grid(bearerToken, data.version, editWdwid, reportSeq);
    chrome_and_static(bearerToken, data.version, level, ['07'], subs);
  });
  think();

  group('7. Add Report List', () => {
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

  group('8. Open Org Report Source Files', () => {
    open_org_source_search(bearerToken, data.version, editWdwid, reportSeq);
    read_org_source_grid(bearerToken, data.version, editWdwid, reportSeq);
    chrome_and_static(bearerToken, data.version, level, ['09'], subs);
  });
  think();

  group('9. Save & Close', () => {
    save_and_close_report(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['10'], subs);
  });
  think();

  group('10. Log Out', () => {
    report_application_unloading(bearerToken, data.version);
    chrome_and_static(bearerToken, data.version, level, ['11'], subs);
  });

  think();
}
