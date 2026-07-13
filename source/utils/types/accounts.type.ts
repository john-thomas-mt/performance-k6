export type AccountRow = {
  name: string;
  acctCode: string;
  rowKey: string;
};

export type AccountSaveResult = {
  ResultValue: number;
  AddedRowKeys: string[];
};
