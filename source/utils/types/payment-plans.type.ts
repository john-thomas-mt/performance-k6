import { SetupData, TransportTable } from './common.type.ts';
import { ServiceOrderRow } from './service-orders.type.ts';

export type PaymentPlanOrderRow = ServiceOrderRow & {
  table: TransportTable;
};

export type PaymentPlanEvent = {
  key: string;
  desc: string;
};

export type PaymentPlanSaveResult = {
  ResultValue: number;
  AddedRowKeys: string[] | null;
  MessageInfoList: { MessageKey: string }[] | null;
};

export type PaymentPlanSetup = SetupData & {
  planPool: PaymentPlanEvent[];
};
