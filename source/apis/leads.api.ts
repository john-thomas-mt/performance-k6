import http from 'k6/http';
import { check, fail, JSONValue } from 'k6';
import { config } from '../utils/exports/config.exp.ts';
import { build_headers, body_text, get_cell } from '../utils/exports/helpers.exp.ts';
import {
  leadObjectColumnsPayload,
  leadsListPayload,
  leadsGridPayload,
  leadCreateFormPayload,
  leadCompanyFieldsPayload,
  leadContactFieldsPayload,
  leadSourceSearchPayload,
  accountRepSearchPayload,
  accountRepRecentlyUsedPayload,
  leadSavePayload,
  leadDetailPayload,
  leadConvertPayload,
  convertResultsGridPayload,
  leadContactsGridPayload,
  leadContactsSearchPayload,
  leadsViewListPayload,
  leadsViewGridPayload,
} from '../utils/exports/data.exp.ts';
import {
  LeadConvertResult,
  LeadFields,
  LeadFormLayout,
  LeadFormSession,
  LeadSaveResult,
  LeadSearchComboRow,
} from '../utils/exports/types.exp.ts';

const LEAD_OBJECT_ID = 1481;

function post_lead(endpoint: string, payload: unknown, token: string, version: string, name: string) {
  const res = http.post(`${config.baseUrl}/api/${endpoint}`, JSON.stringify(payload), {
    headers: build_headers(token, version),
    tags: { name },
  });
  if (!check(res, { [`${name}: status is 201`]: (r) => r.status === 201 })) {
    console.error(`[VU ${__VU}] ${name} failed — HTTP ${res.status}: ${body_text(res).slice(0, 300)}`);
    fail(`${name} did not return 201`);
  }
  return res;
}

function is_lead_layout(el: JSONValue): el is LeadFormLayout {
  return el !== null && typeof el === 'object' && !Array.isArray(el) && el.d3 === LEAD_OBJECT_ID && typeof el.d1 === 'number';
}

function string_at(res: ReturnType<typeof post_lead>, index: number) {
  try {
    const value = (res.json() as JSONValue[])[index];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

function search_combo_key(res: ReturnType<typeof post_lead>) {
  try {
    const rows = JSON.parse(string_at(res, 0)) as LeadSearchComboRow[];
    return rows[0]?.Key ?? '';
  } catch {
    return '';
  }
}

export function get_lead_column_stamp(token: string, version: string, name = 'GetLeadObjectColumns') {
  const res = post_lead('ObjectColumnCacheServer/GetObjectColumns', leadObjectColumnsPayload(), token, version, name);
  const stamp = string_at(res, 2);
  if (!check(stamp, { [`${name}: returns column-cache stamp`]: (s) => /^\d{4}-\d{2}-\d{2} /.test(s) })) {
    console.error(`[VU ${__VU}] get_lead_column_stamp failed — ${body_text(res).slice(0, 200)}`);
    fail(`${name}: no column-cache stamp`);
  }
  return stamp;
}

export function open_leads_list(token: string, version: string, listWdwid: string, name = 'OpenLeadsList') {
  post_lead('GenericListServer/GetInitialData2', leadsListPayload(listWdwid), token, version, name);
}

export function read_leads_grid(token: string, version: string, listWdwid: string, name = 'ReadLeadsGrid') {
  post_lead('USIDataGridServer/GetInitialData2', leadsGridPayload(listWdwid), token, version, name);
}

export function open_leads_view_list(token: string, version: string, listWdwid: string, name = 'OpenLeadsViewList') {
  post_lead('GenericListServer/GetInitialData2', leadsViewListPayload(listWdwid), token, version, name);
}

export function read_leads_view_grid(token: string, version: string, listWdwid: string, name = 'ReadLeadsViewGrid') {
  post_lead('USIDataGridServer/GetInitialData2', leadsViewGridPayload(listWdwid), token, version, name);
}

export function open_lead_create_form(
  token: string,
  version: string,
  formWdwid: string,
  editWdwid: string,
  columnStamp: string,
  name = 'OpenLeadCreateForm',
) {
  const res = post_lead(
    'GenericDetailServer/GetInitialData2',
    leadCreateFormPayload(formWdwid, editWdwid, columnStamp),
    token,
    version,
    name,
  );
  let layout: LeadFormLayout | undefined;
  try {
    layout = (res.json() as JSONValue[]).find(is_lead_layout);
  } catch {
    layout = undefined;
  }
  if (!check(layout, { [`${name}: returns form layout`]: (l) => l !== undefined })) {
    console.error(`[VU ${__VU}] open_lead_create_form failed — no layout for object ${LEAD_OBJECT_ID}`);
    fail(`${name}: form layout not found`);
  }
  return String(layout!.d1);
}

export function refresh_lead_company_fields(
  token: string,
  version: string,
  session: LeadFormSession,
  companyName: string,
  name = 'HandleLeadCompanyFields',
) {
  const { formWdwid, editWdwid, layoutId, tableName } = session;
  const res = post_lead(
    'GenericDetailServer/HandleDependentFields2',
    leadCompanyFieldsPayload(formWdwid, editWdwid, layoutId, tableName, companyName),
    token,
    version,
    name,
  );
  if (!check(res, { [`${name}: echoes company name`]: (r) => body_text(r).includes(companyName) })) {
    console.error(`[VU ${__VU}] refresh_lead_company_fields failed — ${body_text(res).slice(0, 300)}`);
    fail(`${name}: company name not echoed`);
  }
}

export function refresh_lead_contact_fields(
  token: string,
  version: string,
  session: LeadFormSession,
  companyName: string,
  lastName: string,
  name = 'HandleLeadContactFields',
) {
  const { formWdwid, editWdwid, layoutId, tableName } = session;
  const res = post_lead(
    'GenericDetailServer/HandleDependentFields2',
    leadContactFieldsPayload(formWdwid, editWdwid, layoutId, tableName, companyName, lastName),
    token,
    version,
    name,
  );
  if (!check(res, { [`${name}: echoes last name`]: (r) => body_text(r).includes(lastName) })) {
    console.error(`[VU ${__VU}] refresh_lead_contact_fields failed — ${body_text(res).slice(0, 300)}`);
    fail(`${name}: last name not echoed`);
  }
}

export function search_lead_source(token: string, version: string, sourceCode: string, name = 'SearchLeadSource') {
  const res = post_lead('USISearchComboServer/GetDynamicSearchResults', leadSourceSearchPayload(sourceCode), token, version, name);
  const key = search_combo_key(res);
  if (!check(key, { [`${name}: returns lead source key`]: (k) => k !== '' })) {
    console.error(`[VU ${__VU}] search_lead_source found no match for '${sourceCode}' — ${body_text(res).slice(0, 200)}`);
    fail(`${name}: no lead source for ${sourceCode}`);
  }
  return key;
}

export function search_account_rep(token: string, version: string, repName: string, name = 'SearchAccountRep') {
  const res = post_lead('USISearchComboServer/GetDynamicSearchResults', accountRepSearchPayload(repName), token, version, name);
  const key = search_combo_key(res);
  if (!check(key, { [`${name}: returns account rep key`]: (k) => k !== '' })) {
    console.error(`[VU ${__VU}] search_account_rep found no match for '${repName}' — ${body_text(res).slice(0, 200)}`);
    fail(`${name}: no account rep for ${repName}`);
  }
  return key;
}

export function save_recent_account_rep(token: string, version: string, repKey: string, name = 'SaveRecentAccountRep') {
  post_lead('USISearchComboServer/SaveRecentlyUsed', accountRepRecentlyUsedPayload(repKey), token, version, name);
}

export function save_lead(token: string, version: string, session: LeadFormSession, fields: LeadFields, name = 'SaveLead') {
  const { formWdwid, editWdwid, tableName } = session;
  const { companyName, lastName, leadSource, accountRep, email, phone } = fields;
  const res = post_lead(
    'GenericDetailServer/Save2',
    leadSavePayload(formWdwid, editWdwid, tableName, companyName, lastName, leadSource, accountRep, email, phone),
    token,
    version,
    name,
  );

  const result = () => (res.json() as LeadSaveResult[])[0];
  const ok = check(res, {
    [`${name}: ResultValue is 0 (success)`]: () => {
      try {
        return result().ResultValue === 0;
      } catch {
        return false;
      }
    },
    [`${name}: returns new lead row key`]: () => {
      try {
        const k = result().AddedRowKeys;
        return Array.isArray(k) && k.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`[VU ${__VU}] save_lead failed — ${body_text(res).slice(0, 400)}`);
    fail(`${name} did not succeed`);
  }

  return result().AddedRowKeys![0].split('|')[1];
}

export function open_lead_detail(
  token: string,
  version: string,
  editWdwid: string,
  leadId: string,
  columnStamp: string,
  name = 'OpenLeadDetail',
) {
  const res = post_lead('GenericDetailServer/GetInitialData2', leadDetailPayload(editWdwid, leadId, columnStamp), token, version, name);
  if (!check(res, { [`${name}: returns lead ${leadId}`]: (r) => body_text(r).includes(leadId) })) {
    console.error(`[VU ${__VU}] open_lead_detail failed — lead ${leadId} not in response`);
    fail(`${name}: lead ${leadId} not returned`);
  }
}

export function convert_lead_to_account(token: string, version: string, editWdwid: string, leadId: string, name = 'ConvertLeadToAccount') {
  const res = post_lead('GenericDetailServer/AccessServerUI', leadConvertPayload(editWdwid, leadId), token, version, name);

  let result: LeadConvertResult['SaveResult'] | undefined;
  try {
    result = (JSON.parse(string_at(res, 0)) as LeadConvertResult).SaveResult;
  } catch {
    result = undefined;
  }
  const summary = result?.SaveResultData?.InvalidResults?.TransportDataTables[0];

  const ok = check(result, {
    [`${name}: ResultValue is 1 (converted)`]: (r) => r?.ResultValue === 1,
    [`${name}: results summary reports Success`]: () => summary !== undefined && get_cell(summary, 'cMESSAGE') === 'Success',
  });

  if (!ok) {
    console.error(`[VU ${__VU}] convert_lead_to_account failed for lead ${leadId} — ${body_text(res).slice(0, 400)}`);
    fail(`${name} did not succeed`);
  }
}

export function read_convert_results_grid(token: string, version: string, resultsWdwid: string, name = 'ReadConvertResultsGrid') {
  post_lead('USIDataGridServer/GetInitialData2', convertResultsGridPayload(resultsWdwid), token, version, name);
}

export function read_lead_contacts_grid(token: string, version: string, editWdwid: string, leadId: string, name = 'ReadLeadContactsGrid') {
  post_lead('USIDataGridServer/GetInitialData2', leadContactsGridPayload(editWdwid, leadId), token, version, name);
}

export function open_lead_contacts_search(
  token: string,
  version: string,
  editWdwid: string,
  leadId: string,
  name = 'OpenLeadContactsSearch',
) {
  post_lead('GenericSearchServer/GetInitialData2', leadContactsSearchPayload(editWdwid, leadId), token, version, name);
}
