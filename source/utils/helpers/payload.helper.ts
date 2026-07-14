import { TransportTable } from '../exports/types.exp.ts';

export function today_midnight_utc() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function format_retrieve_stamp(epoch: string) {
  const d = new Date(Number(epoch));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
