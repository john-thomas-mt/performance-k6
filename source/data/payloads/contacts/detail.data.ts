import { ContactRow } from '../../../utils/exports/types.exp.ts';

/* Captured contact detail open (window ES8300, object 286). Identity and designation flags come from the picked grid row; SyncOrgCode/SyncAcctCode stay as captured, as the NeoLoad script sends them. */
export const contactDetailPayload = (contact: ContactRow, columnStamp: string) => [
  [
    {
      Key: 'EmailAddress',
      Value: contact.email,
    },
    {
      Key: 'AcctClass',
      Value: contact.acctClass,
    },
    {
      Key: 'EvtSalesDesig',
      Value: contact.evtSalesDesig,
    },
    {
      Key: 'PubRelDesig',
      Value: contact.pubRelDesig,
    },
    {
      Key: 'MemberDesig',
      Value: contact.memberDesig,
    },
    {
      Key: 'ReceivablesDesig',
      Value: contact.arDesig,
    },
    {
      Key: 'SupplierDesig',
      Value: contact.apDesig,
    },
    {
      Key: 'VisitorInquiryDesig',
      Value: contact.visitorDesig,
    },
    {
      Key: 'RegistrationDesig',
      Value: contact.regisDesig,
    },
    {
      Key: 'PersDesig',
      Value: contact.persDesig,
    },
    {
      Key: 'SpeakerDesig',
      Value: contact.spkrDesig,
    },
    {
      Key: 'AttendeeDesig',
      Value: contact.attendeeDesig,
    },
    {
      Key: 'PrimaryAcct',
      Value: contact.primaryAcct,
    },
    {
      Key: 'SyncOrgCode',
      Value: '**',
    },
    {
      Key: 'SyncAcctCode',
      Value: '*MASTER',
    },
    {
      Key: 'AcctCode',
      Value: contact.acctCode,
    },
    {
      Key: 'OrgCode',
      Value: contact.orgCode,
    },
    {
      Key: 'RowKeyList',
      Value: contact.rowKey,
    },
    {
      Key: 'WindowObjectID',
      Value: 286,
    },
    {
      Key: 'WdwType',
      Value: 3,
    },
    {
      Key: 'SplitterOrientation1',
      Value: 0,
    },
    {
      Key: 'wdwid',
      Value: 'ES8300',
    },
    {
      Key: 'OrgAdmin',
      Value: false,
    },
    {
      Key: 'ListPageObjectID',
      Value: 286,
    },
    {
      Key: 'AcctDesig',
      Value: 'C',
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
  'ES8300',
  2,
  286,
  609,
  0,
  columnStamp,
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
