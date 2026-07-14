import http from 'k6/http';
import { check, fail } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, parse_grid_rows } from '../utils/exports/helpers.exp.ts';
import {
  reportMasterListPayload,
  reportMasterGridPayload,
  addReportFormPayload,
  crystalReportSavePayload,
  reportListsSearchPayload,
  reportListsGridPayload,
  reportListSuperboxPayload,
  reportListSavePayload,
  orgSourceSearchPayload,
  orgSourceGridPayload,
} from '../utils/exports/data.exp.ts';
import { ReportSaveResult, ReportListWindowInfo, ReportListContext, ReportListRow } from '../utils/exports/types.exp.ts';

export function open_report_master_list(token: string, version: string, name = 'OpenReportMasterList') {
  const res = http.post(`${config.baseUrl}/api/GenericListServer/GetInitialData2`, JSON.stringify(reportMasterListPayload()), {
    headers: build_headers(token, version),
    tags: { name },
  });
  const ok = check(res, { [`${name}: status is 201`]: (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] open_report_master_list failed — HTTP ${res.status}`);
    fail('open_report_master_list did not succeed');
  }
}

export function read_report_master_grid(token: string, version: string, name = 'ReadReportMasterGrid') {
  const res = http.post(`${config.baseUrl}/api/USIDataGridServer/GetInitialData2`, JSON.stringify(reportMasterGridPayload()), {
    headers: build_headers(token, version),
    tags: { name },
  });
  const ok = check(res, { [`${name}: status is 201`]: (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] read_report_master_grid failed — HTTP ${res.status}`);
    fail('read_report_master_grid did not succeed');
  }
}

export function open_add_report_form(token: string, version: string, detailWdwid: string, editWdwid: string) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/GetInitialData2`,
    JSON.stringify(addReportFormPayload(detailWdwid, editWdwid)),
    { headers: build_headers(token, version), tags: { name: 'OpenAddReportForm' } },
  );
  const ok = check(res, { 'OpenAddReportForm: status is 201': (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] open_add_report_form failed — HTTP ${res.status}`);
    fail('open_add_report_form did not succeed');
  }
}

export function save_crystal_report(
  token: string,
  version: string,
  reportName: string,
  reportId: string,
  detailWdwid: string,
  editWdwid: string,
) {
  const res = http.post(
    `${config.baseUrl}/api/GenericDetailServer/Save2`,
    JSON.stringify(crystalReportSavePayload(reportName, reportId, detailWdwid, editWdwid)),
    { headers: build_headers(token, version), tags: { name: 'SaveCrystalReport' } },
  );

  const ok = check(res, {
    'SaveCrystalReport: status is 201': (r) => r.status === 201,
    'SaveCrystalReport: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as ReportSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
    'SaveCrystalReport: returns new report sequence': (r) => {
      try {
        const k = (r.json() as ReportSaveResult[])[0].AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    let detail = body_text(res).slice(0, 300);
    try {
      detail = JSON.stringify((res.json() as ReportSaveResult[])[0].MessageInfoList);
    } catch {
      /* keep raw slice */
    }
    console.error(`[VU ${__VU}] save_crystal_report failed — HTTP ${res.status}: ${detail}`);
    fail('save_crystal_report did not succeed');
  }

  return (res.json() as ReportSaveResult[])[0].AddedRowKeys![0];
}

export function open_report_lists_search(token: string, version: string, editWdwid: string, reportSeq: string) {
  const res = http.post(
    `${config.baseUrl}/api/GenericSearchServer/GetInitialData2`,
    JSON.stringify(reportListsSearchPayload(editWdwid, reportSeq)),
    { headers: build_headers(token, version), tags: { name: 'OpenReportListsSearch' } },
  );
  const ok = check(res, { 'OpenReportListsSearch: status is 201': (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] open_report_lists_search failed — HTTP ${res.status}`);
    fail('open_report_lists_search did not succeed');
  }
}

export function read_report_lists_grid(token: string, version: string, editWdwid: string, reportSeq: string) {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/GetInitialData2`,
    JSON.stringify(reportListsGridPayload(editWdwid, reportSeq)),
    { headers: build_headers(token, version), tags: { name: 'ReadReportListsGrid' } },
  );
  const ok = check(res, { 'ReadReportListsGrid: status is 201': (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] read_report_lists_grid failed — HTTP ${res.status}`);
    fail('read_report_lists_grid did not succeed');
  }
}

export function get_report_list_window(token: string, version: string, superboxWdwid: string) {
  const res = http.get(`${config.baseUrl}/api/WindowServer/GetWindowInfo?astrWindowID=${superboxWdwid}`, {
    headers: build_headers(token, version),
    tags: { name: 'GetReportListWindowInfo' },
  });
  const ok = check(res, {
    'GetReportListWindowInfo: status is 201': (r) => r.status === 201,
    'GetReportListWindowInfo: returns ContextObjectID': (r) => {
      try {
        return typeof (r.json() as ReportListWindowInfo[])[0]?.ContextObjectID === 'number';
      } catch {
        return false;
      }
    },
  });
  if (!ok) {
    console.error(`[VU ${__VU}] get_report_list_window failed for "${superboxWdwid}" — HTTP ${res.status}`);
    fail('get_report_list_window did not succeed');
  }
  return (res.json() as ReportListWindowInfo[])[0].ContextObjectID;
}

export function open_report_list_superbox(token: string, version: string, ctx: ReportListContext) {
  const res = http.post(
    `${config.baseUrl}/api/USIMultiSelectSuperBoxPageServer/GetInitialData`,
    JSON.stringify(reportListSuperboxPayload(ctx)),
    { headers: build_headers(token, version), tags: { name: 'OpenReportListSuperbox' } },
  );
  const ok = check(res, { 'OpenReportListSuperbox: status is 201': (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] open_report_list_superbox failed — HTTP ${res.status}`);
    fail('open_report_list_superbox did not succeed');
  }
  return parse_grid_rows(
    res,
    { rptList: 'MM842_RPT_LIST', desc: 'MM842_DESC', entStamp: 'MM842_ENT_STAMP' },
    'OpenReportListSuperbox',
  ) as ReportListRow[];
}

export function save_report_list(token: string, version: string, ctx: ReportListContext, chosen: ReportListRow) {
  const res = http.post(`${config.baseUrl}/api/USIMultiSelectSuperBoxPageServer/save`, JSON.stringify(reportListSavePayload(ctx, chosen)), {
    headers: build_headers(token, version),
    tags: { name: 'SaveReportList' },
  });
  const ok = check(res, {
    'SaveReportList: status is 201': (r) => r.status === 201,
    'SaveReportList: ResultValue is 0 (success)': (r) => {
      try {
        return (r.json() as ReportSaveResult[])[0].ResultValue === 0;
      } catch {
        return false;
      }
    },
  });
  if (!ok) {
    let detail = body_text(res).slice(0, 300);
    try {
      detail = JSON.stringify((res.json() as ReportSaveResult[])[0].MessageInfoList);
    } catch {
      /* keep raw slice */
    }
    console.error(`[VU ${__VU}] save_report_list failed — HTTP ${res.status}: ${detail}`);
    fail('save_report_list did not succeed');
  }
}

export function open_org_source_search(token: string, version: string, editWdwid: string, reportSeq: string) {
  const res = http.post(
    `${config.baseUrl}/api/GenericSearchServer/GetInitialData2`,
    JSON.stringify(orgSourceSearchPayload(editWdwid, reportSeq)),
    { headers: build_headers(token, version), tags: { name: 'OpenOrgSourceSearch' } },
  );
  const ok = check(res, { 'OpenOrgSourceSearch: status is 201': (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] open_org_source_search failed — HTTP ${res.status}`);
    fail('open_org_source_search did not succeed');
  }
}

export function read_org_source_grid(token: string, version: string, editWdwid: string, reportSeq: string) {
  const res = http.post(
    `${config.baseUrl}/api/USIDataGridServer/GetInitialData2`,
    JSON.stringify(orgSourceGridPayload(editWdwid, reportSeq)),
    { headers: build_headers(token, version), tags: { name: 'ReadOrgSourceGrid' } },
  );
  const ok = check(res, { 'ReadOrgSourceGrid: status is 201': (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] read_org_source_grid failed — HTTP ${res.status}`);
    fail('read_org_source_grid did not succeed');
  }
}

export function save_and_close_report(token: string, version: string) {
  open_report_master_list(token, version, 'SaveAndCloseReport');
}

export function report_application_unloading(token: string, version: string) {
  const res = http.get(`${config.baseUrl}/api/GenericServer/ApplicationUnloading`, {
    headers: build_headers(token, version),
    tags: { name: 'ReportApplicationUnloading' },
  });
  const ok = check(res, { 'ReportApplicationUnloading: status is 201': (r) => r.status === 201 });
  if (!ok) {
    console.error(`[VU ${__VU}] report_application_unloading failed — HTTP ${res.status}`);
    fail('report_application_unloading did not succeed');
  }
}
