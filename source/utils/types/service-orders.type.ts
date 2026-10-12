import { SetupData, TransportTable, User } from './common.type.ts';
import { EventRow } from './events.type.ts';

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
  acctName: string;
  funcDesc: string;
  updDateIso: string;
};

export type ServiceOrderDocumentFields = {
  fileKey: string;
  fileName: string;
  docDesc: string;
  evFunc: string;
};

export type ServiceOrderItemsForm = {
  startDate: string;
  endDate: string;
  table: TransportTable;
};

export type ServiceOrderDocumentFixture = {
  name: string;
  content: ArrayBuffer;
};

export type EditServiceOrderSetup = SetupData & {
  editOrderPool: EventRow[];
};

export type ServiceOrderSaveResult = {
  ResultValue: number;
  ModifiedRowKeys: string[] | null;
  AddedRowKeys: string[] | null;
  AdditionalTableNameAddedRowKeys: { [tableName: string]: string[] } | null;
};

export type PooledServiceOrder = ServiceOrderRow & {
  evtDesc: string;
};

export type ServiceOrderSetup = SetupData & {
  soPool: PooledServiceOrder[];
};

export type SeedSetup = {
  version: string;
  users: User[];
  shortfall: number;
};

export type SeedSession = {
  version: string;
  bearerToken: string;
  encUserId: string;
  windowVersion: string;
};
