export type EventRow = {
  desc: string;
  evtId: string;
  rowKey: string;
  acct: string;
  desig: string;
  status: string;
  linkedFuncs: string;
  orgCode: string;
};

export type EventSaveResult = {
  ResultValue: number;
  AddedRowKeys: string[];
};
