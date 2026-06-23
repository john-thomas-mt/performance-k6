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

export interface SaveResult {
  ResultValue: number;
  ModifiedRowKeys: string[] | null;
  AdditionalTableNameAddedRowKeys: Record<string, string[]> | null;
}
