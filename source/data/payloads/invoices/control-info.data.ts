import { coerce_transport_types } from '../../../utils/exports/helpers.exp.ts';
import { NonInvoicedOrderRow, TransportTable } from '../../../utils/exports/types.exp.ts';

/* Captured GetControlInfo the grid fires when a Non-Invoiced Orders By Event row is selected (window 280 / AR2245). The body echoes the selected row; the server's answer is discarded. */
export const nonInvoicedOrderControlInfoPayload = (row: NonInvoicedOrderRow) => [
  '10',
  280,
  744,
  0,
  1,
  0,
  2,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 280,
    },
    {
      Key: 'wdwid',
      Value: 'AR2245',
    },
    {
      Key: 'WdwType',
      Value: 1,
    },
    {
      Key: 'wdwMode',
      Value: 0,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 0,
    },
    {
      Key: 'MenuType',
      Value: 1,
    },
    {
      Key: 'ParentWindowType',
      Value: 10,
    },
    {
      Key: 'ParentWindowID',
      Value: 'WB8108',
    },
    {
      Key: 'AssemblyName',
      Value: '',
    },
    {
      Key: 'ClassName',
      Value: 'home',
    },
    {
      Key: 'WdwContextObjectIDForFav',
      Value: 744,
    },
  ],
  { TransportDataTables: [nonInvoicedOrderControlInfoTable(row)] },
  { [`10|${row.orderNbr}`]: [16785] },
  [16751, 50699],
  11,
];

/* The grid response carries 51 columns; the control-info request appends five client-computed columns
   that mirror cells of the row (the COMP_ copies and the numeric sort key of the order number). */
const nonInvoicedOrderControlInfoTable = (row: NonInvoicedOrderRow): TransportTable => {
  const { orderNbr, evtId, table } = row;
  const cell = (column: string) =>
    table.TransportDataRows[0].Values[String(table.TransportDataColumns.findIndex((c) => c.ColumnName === column))];
  const first = table.TransportDataColumns.length;
  return coerce_transport_types({
    TableName: `${Date.now()}`,
    TransportDataColumns: [
      ...table.TransportDataColumns,
      { ColumnName: 'COMP_ER100_ORD_ACCT', DataType: 'System.String', DefaultValue: null, ColumnID: first },
      { ColumnName: 'COMP_ER100_NEW_STS', DataType: 'System.String', DefaultValue: null, ColumnID: first + 1 },
      { ColumnName: 'COMP_ER100_PAY_PLAN_ID', DataType: 'System.Int32', DefaultValue: null, ColumnID: first + 2 },
      { ColumnName: 'COMP_ER100_EVT_ID', DataType: 'System.Int32', DefaultValue: null, ColumnID: first + 3 },
      { ColumnName: 'ER100_ORD_NBR__EDIT_SORT', DataType: 'System.Int32', DefaultValue: null, ColumnID: first + 4 },
    ],
    TransportDataRows: [
      {
        Values: {
          ...table.TransportDataRows[0].Values,
          [String(first)]: cell('ER100_ORD_ACCT'),
          [String(first + 1)]: cell('ER100_NEW_STS'),
          [String(first + 2)]: cell('ER100_PAY_PLAN_ID'),
          [String(first + 3)]: Number(evtId),
          [String(first + 4)]: Number(orderNbr),
        },
      },
    ],
  });
};
