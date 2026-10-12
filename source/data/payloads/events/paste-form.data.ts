import { format_retrieve_stamp } from '../../../utils/exports/helpers.exp.ts';

export const pasteFunctionsFormPayload = (evtId: string, functionIds: string, refreshKey: number) => [
  [
    {
      Key: 'PasteFuncID',
      Value: functionIds,
    },
    {
      Key: 'MultiSelect',
      Value: 'Y',
    },
    {
      Key: 'panel',
      Value: 'N',
    },
    {
      Key: 'FuncTypeID',
      Value: 'B',
    },
    {
      Key: 'WdwType',
      Value: 12,
    },
    {
      Key: 'SelectedAction',
      Value: 3075,
    },
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'PasteEvtID',
      Value: Number(evtId),
    },
    {
      Key: 'SelectedEvent',
      Value: Number(evtId),
    },
    {
      Key: 'wdwid',
      Value: 'EM2076',
    },
    {
      Key: 'WindowObjectID',
      Value: 23,
    },
    {
      Key: 'SelectedFunctions',
      Value: functionIds,
    },
    {
      Key: 'RefreshDependentKey',
      Value: refreshKey,
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
  'EM2076',
  0,
  23,
  0,
  0,
  format_retrieve_stamp(String(refreshKey)),
  '',
  '',
  {
    TransportDataColumns: [],
    TransportDataRows: [],
    TableName: '',
  },
  [],
  true,
];
