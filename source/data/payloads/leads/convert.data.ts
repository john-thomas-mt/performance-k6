/* Captured AccessServerUI ConvertLeadToAccount server action on the lead detail window. The context bag carries the LeadID as a number, the action arguments carry it as a string. */
export const leadConvertPayload = (editWdwid: string, leadId: string) => [
  '10',
  1481,
  609,
  0,
  4,
  2,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 1481,
    },
    {
      Key: 'wdwid',
      Value: editWdwid,
    },
    {
      Key: 'WdwType',
      Value: 4,
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
      Value: 6,
    },
    {
      Key: 'EvtSalesDesig',
      Value: '1',
    },
    {
      Key: 'AcctDesig',
      Value: 'C',
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
      Key: 'MenuObjectID',
      Value: 0,
    },
    {
      Key: 'MenuContextObjectID',
      Value: 0,
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
    {
      Key: 'LeadID',
      Value: Number(leadId),
    },
  ],
  'ConvertLeadToAccount',
  [
    {
      Key: 'LeadID',
      Value: leadId,
    },
    {
      Key: 'CheckPotentialDuplicates',
      Value: true,
    },
  ],
];
