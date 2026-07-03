import { SetupData, User } from './common.type.ts';

export interface ServiceOrderRow {
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
}

export interface DocumentFields {
  fileKey: string;
  fileName: string;
  docDesc: string;
}

export interface ServiceOrderSaveResult {
  ResultValue: number;
  ModifiedRowKeys: string[] | null;
  AddedRowKeys: string[] | null;
  AdditionalTableNameAddedRowKeys: Record<string, string[]> | null;
}

export interface ServiceOrderSetup extends SetupData {
  soPool: ServiceOrderRow[];
}

export interface SmokeSetup extends ServiceOrderSetup {
  users: User[];
}

export interface ServiceOrderSeedSetup {
  version: string;
  evtId: string;
  bearerToken: string;
  encUserId: string;
}
