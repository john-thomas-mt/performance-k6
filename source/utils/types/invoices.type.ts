import { TransportTable } from './common.type.ts';

export type NonInvoicedOrderRow = {
  orderNbr: string;
  evtId: string;
  table: TransportTable;
};

export type InvoiceSaveResult = {
  ResultValue: number;
  ErrorCodes: string[];
  MessageInfoList: { MessageKey: string }[];
};
