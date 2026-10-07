import { coerce_transport_types } from '../../../utils/exports/helpers.exp.ts';
import { PaymentPlanOrderRow, TransportTable } from '../../../utils/exports/types.exp.ts';

/* Captured Service Orders GetControlInfo (window 4 / EM8066). The browser echoes the selected grid row back
   as a 62-column table: the grid's own columns minus ER100_TRANS_SOURCE, renumbered, plus four client-computed
   columns that mirror cells of the row. The 440 beside the row key is the recorded row-level control id. */
export const paymentPlanOrderControlInfoPayload = (row: PaymentPlanOrderRow) => [
  '10',
  4,
  0,
  0,
  1,
  0,
  2,
  [
    { Key: 'OrgCode', Value: '10' },
    { Key: 'WindowObjectID', Value: 4 },
    { Key: 'wdwid', Value: 'EM8066' },
    { Key: 'WdwType', Value: 1 },
    { Key: 'wdwMode', Value: 0 },
    { Key: 'RemoveEditLayoutLink', Value: false },
    { Key: 'ContextObjectID', Value: 0 },
    { Key: 'MenuType', Value: 1 },
    { Key: 'MenuObjectID', Value: 0 },
    { Key: 'MenuContextObjectID', Value: 0 },
  ],
  { TransportDataTables: [paymentPlanControlInfoTable(row)] },
  { [`10|${row.orderNbr}`]: [440] },
  [2753],
  11,
];

const paymentPlanControlInfoTable = (row: PaymentPlanOrderRow): TransportTable => {
  const { table } = row;
  const source = table.TransportDataColumns.filter((c) => c.ColumnName !== 'ER100_TRANS_SOURCE');
  const cell = (column: string) => {
    const i = table.TransportDataColumns.findIndex((c) => c.ColumnName === column);
    return table.TransportDataRows[0].Values[String(i)];
  };
  const computed = [
    { ColumnName: 'COMP_ER100_ORD_ACCT', DataType: 'System.String', value: cell('ER100_ORD_ACCT') },
    { ColumnName: 'COMP_ER100_EVT_ID', DataType: 'System.Int32', value: Number(row.evtId) },
    { ColumnName: 'COMP_ER100_NEW_STS', DataType: 'System.String', value: cell('ER100_NEW_STS') },
    { ColumnName: 'ER100_ORD_DATE__EDIT_SORT', DataType: 'System.DateTime', value: cell('ER100_ORD_DATE') },
  ];
  const columns = [...source, ...computed].map((c, i) => ({
    ColumnName: c.ColumnName,
    DataType: c.DataType,
    DefaultValue: null,
    ColumnID: i,
  }));
  const values = Object.fromEntries([
    ...source.map((c, i) => [String(i), cell(c.ColumnName)] as const),
    ...computed.map((c, i) => [String(source.length + i), c.value] as const),
  ]);
  return coerce_transport_types({
    TableName: `${Date.now()}`,
    TransportDataColumns: columns,
    TransportDataRows: [{ Values: values }],
  });
};
