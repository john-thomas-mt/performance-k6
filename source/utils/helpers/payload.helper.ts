import { ReportDateRange, TransportTable } from '../exports/types.exp.ts';

export function today_midnight_utc() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function format_retrieve_stamp(epoch: string) {
  const d = new Date(Number(epoch));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function stamp_to_epoch(stamp: string) {
  return String(Date.parse(`${stamp.replace(' ', 'T')}Z`));
}

export const save2CreateChangeTracking = {
  SaveMode: 7,
  Delete: false,
  Tag: {},
  MessageInfoList: [],
  WorkflowToolbarButtonID: 0,
  AddedRowKeys: ['10|-1'],
  ModifiedRowKeys: [],
  DeletedRowKeys: [],
  UnchangedRowKeys: [],
  AdditionalTableKeyAddedRowKeys: [],
  AdditionalTableKeyModifiedRowKeys: [],
  AdditionalTableKeyDeletedRowKeys: [],
  AdditionalTableKeyUnchangedRowKeys: [],
};

const save2Refresh = {
  AutoRefresh: 'Y',
  EnterUserID: '',
  FilterCriteria: '',
  ID: 0,
  ObjectID: 0,
  OrgCode: null,
  ResultsCount: 0,
  ResultsLimit: 0,
  ResultsTime: 0,
  SearchDesc: '',
  SearchFilters: [],
  ThemeID: 0,
  USIID: 0,
  UpdateUserID: '',
  UserID: '',
  SourceUSIID: 0,
  ConvertToUserDisplayTimeZone: false,
};

export const save2_envelope = (
  head: (string | number)[],
  windowBag: { Key: string; Value: string | number | boolean }[],
  table: TransportTable,
  changeTracking: object = save2CreateChangeTracking,
) => [...head, windowBag, changeTracking, { TransportDataTables: [table] }, { TransportDataTables: [] }, save2Refresh];

export function random_date_range(minSpanDays = 1, maxSpanDays = 365): ReportDateRange {
  const now = new Date();
  const fiveYearsAgo = Date.UTC(now.getUTCFullYear() - 5, now.getUTCMonth(), now.getUTCDate());
  const end = new Date(now.getTime() - Math.random() * (now.getTime() - fiveYearsAgo));
  const spanDays = Math.floor(Math.random() * (maxSpanDays - minSpanDays + 1)) + minSpanDays;
  const start = new Date(end.getTime() - spanDays * 86400000);
  const format = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { startDate: format(start), endDate: format(end) };
}
