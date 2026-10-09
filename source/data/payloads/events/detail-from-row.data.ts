import { format_retrieve_stamp } from '../../../utils/exports/helpers.exp.ts';
import { EventRow } from '../../../utils/exports/types.exp.ts';

export const eventDetailFromRowPayload = (event: EventRow, refreshKey: number) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1,
    },
    {
      Key: 'wdwid',
      Value: 'EB8074',
    },
    {
      Key: 'WdwType',
      Value: 4,
    },
    {
      Key: 'wdwMode',
      Value: 2,
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
      Value: 4,
    },
    {
      Key: 'EvtAcct',
      Value: event.acct,
    },
    {
      Key: 'EvtDesig',
      Value: event.desig,
    },
    {
      Key: 'EvtStatus',
      Value: event.status,
    },
    {
      Key: 'LinkedFuncs',
      Value: event.linkedFuncs,
    },
    {
      Key: 'RowKeyList',
      Value: event.rowKey,
    },
    {
      Key: 'RefreshDependentKey',
      Value: refreshKey,
    },
    {
      Key: 'EvtID',
      Value: event.evtId,
    },
    {
      Key: 'ForceOneColumnLayout',
      Value: false,
    },
    {
      Key: 'ShowHelpTextInfo',
      Value: true,
    },
    {
      Key: 'MoveGeneralSectionToNewTab',
      Value: true,
    },
    {
      Key: 'ShowQuickInfoHeader',
      Value: true,
    },
  ],
  'EB8074',
  2,
  1,
  0,
  0,
  format_retrieve_stamp(String(refreshKey)),
  '',
  null,
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];
