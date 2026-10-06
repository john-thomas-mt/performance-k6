/* Captured Work Orders window (EM8066) actions that complete an order's work orders and close it, which is
   what makes the order show up in Non-Invoiced Orders By Event. */
export const canCompleteWorkOrdersPayload = () => workOrderAction('CanCompleteWorkOrders', []);

export const completeWorkOrdersPayload = (orderNbr: string) =>
  workOrderAction('CompleteWorkOrders', [
    { Key: 'SelectedRowKeys', Value: [`10|${orderNbr}`] },
    {
      Key: 'SaveInfo',
      Value: {
        SaveMode: 8,
        Delete: false,
        Tag: {},
        MessageInfoList: [],
        WorkflowToolbarButtonID: 0,
        AddedRowKeys: [],
        ModifiedRowKeys: [],
        DeletedRowKeys: [],
        UnchangedRowKeys: [],
        AdditionalTableKeyAddedRowKeys: [],
        AdditionalTableKeyModifiedRowKeys: [],
        AdditionalTableKeyDeletedRowKeys: [],
        AdditionalTableKeyUnchangedRowKeys: [],
      },
    },
    { Key: 'USISaveMode', Value: 8 },
  ]);

/* CloseDate is today's midnight in UTC epoch ms (the recording's GMT-midnight jsAction). */
export const closeOrderPayload = (orderNbr: string, closeDate: number) =>
  workOrderAction('CloseOrderSave', [
    { Key: 'RowKeyList', Value: [`10|${orderNbr}`] },
    { Key: 'CloseDate', Value: closeDate },
  ]);

const workOrderAction = (action: string, args: { Key: string; Value: unknown }[]) => [
  '10',
  4,
  0,
  0,
  1,
  0,
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
  action,
  [{ Key: 'OrgCode', Value: '10' }, ...args],
];
