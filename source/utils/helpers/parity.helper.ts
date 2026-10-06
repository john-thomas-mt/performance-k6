import { check } from 'k6';
import { EventRow, ServiceOrderRow } from '../exports/types.exp.ts';

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
