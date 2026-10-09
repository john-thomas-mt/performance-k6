import { coerce_transport_types } from '../../../utils/exports/helpers.exp.ts';
import { TransportTable } from '../../../utils/exports/types.exp.ts';

export const paymentPlanScheduleCode = '50';

/* The browser builds the Payment Plan row from the EM9965 open response: the same 28 cells with the schedule code
   chosen, natives coerced from strings, and two client-computed columns appended (the next-due date and the bill-to,
   both mirrored from the row). -2208988800000 is the 1900-01-01 "no date" epoch the form shows for a blank next-due. */
export const paymentPlanFormTable = (openTable: TransportTable, billTo: string): TransportTable => {
  const source = openTable.TransportDataColumns;
  const columns = [
    ...source,
    { ColumnName: 'COMP_UF_ER200_NEXT_DUE_DATE', DataType: 'System.DateTime', DefaultValue: null, ColumnID: source.length },
    { ColumnName: 'COMP_ER200_BILLTO_CUST', DataType: 'System.String', DefaultValue: null, ColumnID: source.length + 1 },
  ];
  const values = {
    ...openTable.TransportDataRows[0].Values,
    [String(source.findIndex((c) => c.ColumnName === 'ER200_SCHED_CODE'))]: paymentPlanScheduleCode,
    [String(source.length)]: -2208988800000,
    [String(source.length + 1)]: billTo,
  };
  return coerce_transport_types({
    TableName: `${Date.now()}`,
    TransportDataColumns: columns,
    TransportDataRows: [{ Values: values }],
  });
};
