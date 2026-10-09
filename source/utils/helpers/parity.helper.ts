import { check } from 'k6';
import { EventFunctionRow, EventRow, PurchaseOrderCells, ServiceOrderRow } from '../exports/types.exp.ts';

type RecordFields = { [field: string]: string };

export const eventIdentityFields: (keyof EventRow)[] = [
  'desc',
  'evtId',
  'rowKey',
  'acct',
  'acctName',
  'acctClass',
  'evtStartDate',
  'evtStartTime',
  'evtEndDate',
  'evtEndTime',
  'evtInDate',
  'evtInTime',
];

export const eventFunctionIdentityFields: (keyof EventFunctionRow)[] = ['desc'];

export const serviceOrderIdentityFields: (keyof ServiceOrderRow)[] = [
  'orderNbr',
  'soSearch',
  'rowKey',
  'ordAcct',
  'billTo',
  'evtId',
  'funcId',
  'btoContact',
  'ordContact',
  'reqContact',
  'salesPer',
  'priceList',
  'reqCust',
  'shipTo',
  'shipToContact',
  'acctClass',
  'acctName',
  'funcDesc',
  'updDateIso',
];

export const purchaseOrderIdentityFields: (keyof PurchaseOrderCells & string)[] = [
  'PO100_DESC',
  'PO100_SEARCH',
  'PO100_ORD_NBR',
  'PO100_PO_REQ',
  'PO100_DATE',
  'PO100_DATE_IN',
  'PO100_DATE_OUT',
  'PO100_DUE_DATE',
  'PO100_ENT_STAMP',
  'PO100_UPD_STAMP',
  'cINOUT_DATE',
  'cUPDATED',
  'PO100_SUPPLIER',
  'PO100_SUPPLIER_CONT_NG',
  'POSupplierAccount_EV870_NAME',
  'POSupplierAccount_EV870_CLASS',
  'POSupplierContact_EV870_CLASS',
  'PO100_TOT_STD_COST',
  'PO100_TOT_EST_COST',
  'cCOMP_ENT_BY_NAME',
  'cCOMP_CHG_BY_NAME',
];

export function compare_record_fields<T extends RecordFields>(label: string, reference: T, seeded: T, varying: (keyof T & string)[]) {
  const skip = new Set<string>(varying);
  const differ = Object.keys(reference).filter((field) => !skip.has(field) && reference[field] !== seeded[field]);
  for (const field of differ) console.warn(`${label}.${field}: NeoLoad '${reference[field]}', k6 seed '${seeded[field]}'`);
  check(differ, { [`${label}: fields match the NeoLoad record`]: (d) => d.length === 0 });
  return differ;
}

export function compare_record_count(label: string, reference: number, seeded: number) {
  if (reference !== seeded) console.warn(`${label}: NeoLoad ${reference}, k6 seed ${seeded}`);
  check(seeded, { [`${label}: count matches the NeoLoad record`]: (n) => n === reference });
}
