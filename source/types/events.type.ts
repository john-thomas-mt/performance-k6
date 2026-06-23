export interface EventRow {
  desc: string;
  evtId: string;
  rowKey: string;
  acct: string;
  desig: string;
  status: string;
  linkedFuncs: string;
  orgCode: string;
}

export interface SaveResult {
  ResultValue: number;
  AddedRowKeys: string[];
}
