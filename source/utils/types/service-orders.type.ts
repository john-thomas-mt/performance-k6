import { SetupData, User } from './common.type.ts';

export type ServiceOrderRow = {
  orderNbr: string;
  soSearch: string;
  rowKey: string;
  orgCode: string;
  ordAcct: string;
  billTo: string;
  evtId: string;
  funcId: string;
  btoContact: string;
  ordContact: string;
  reqContact: string;
  salesPer: string;
  orderType: string;
  priceList: string;
  reqCust: string;
  resPhase: string;
  shipTo: string;
  shipToContact: string;
  evtDesig: string;
  acctClass: string;
  evtStatus: string;
  status: string;
  invoice: string;
  exhibitorId: string;
  occurrence: string;
  eventSuiteId: string;
  ordCatSeq: string;
};

export type DocumentFields = {
  fileKey: string;
  fileName: string;
  docDesc: string;
};

export type ServiceOrderSaveResult = {
  ResultValue: number;
  ModifiedRowKeys: string[] | null;
  AddedRowKeys: string[] | null;
  AdditionalTableNameAddedRowKeys: { [tableName: string]: string[] } | null;
};

export type ServiceOrderSetup = SetupData & {
  soPool: ServiceOrderRow[];
};

export type SmokeSetup = ServiceOrderSetup & {
  users: User[];
};

export type ServiceOrderSeedSetup = {
  version: string;
  evtId: string;
  bearerToken: string;
  encUserId: string;
};
