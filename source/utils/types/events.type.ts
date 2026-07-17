export type EventRow = {
  desc: string;
  evtId: string;
  rowKey: string;
  acct: string;
  desig: string;
  status: string;
  linkedFuncs: string;
  orgCode: string;
  acctName: string;
  acctClass: string;
  evtType: string;
  cEvtType: string;
  cEvtTypeSort: string;
  purgeInd: string;
  plnAttend: string;
  parentEvtId: string;
  evtStartDate: string;
  evtStartTime: string;
  evtEndDate: string;
  evtEndTime: string;
  evtInDate: string;
  evtInTime: string;
};

export type EventSaveResult = {
  ResultValue: number;
  AddedRowKeys: string[];
};

export type EventDetailContext = {
  evtCntct: string;
  evtSalesPer: string;
  evtCategory: string;
  evtPriceList: string;
  coord1: string;
  coord2: string;
};

export type EventDocumentContext = {
  evtAcct: string;
  evtId: string;
  evtDesig: string;
  evtStatus: string;
  orgCode: string;
  rowKey: string;
} & EventDetailContext;

export type EventDocumentFields = {
  fileKey: string;
  fileName: string;
  docDesc: string;
  evtDesc: string;
  acctName: string;
};

export type EventDocumentFixture = {
  name: string;
  content: ArrayBuffer;
};
