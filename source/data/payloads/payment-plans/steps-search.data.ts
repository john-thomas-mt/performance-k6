export const paymentPlanStepsSearchPayload = (orderNbr: string, payPlanId: string) => [
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'WindowObjectID',
      Value: 229,
    },
    {
      Key: 'wdwid',
      Value: 'EM9999',
    },
    {
      Key: 'WdwType',
      Value: 2,
    },
    {
      Key: 'wdwMode',
      Value: 1,
    },
    {
      Key: 'RemoveEditLayoutLink',
      Value: false,
    },
    {
      Key: 'ContextObjectID',
      Value: 229,
    },
    {
      Key: 'PayScheduleCode',
      Value: '',
    },
    {
      Key: 'OrderRowKeys',
      Value: `10|${orderNbr}`,
    },
    {
      Key: 'ContractSeq',
      Value: 0,
    },
    {
      Key: 'OrderType',
      Value: 'SO',
    },
    {
      Key: 'ForceOneColumnLayout',
      Value: true,
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
      Key: 'PayPlanID',
      Value: Number(payPlanId),
    },
    {
      Key: 'IsUsedForSectionFiltering',
      Value: 'Y',
    },
  ],
  'EM9999',
  0,
  650,
  229,
  0,
  {
    AutoRefresh: 'Y',
    EnterUserID: 'CHROMEREG',
    FilterCriteria: '',
    ID: 58722,
    ObjectID: 650,
    OrgCode: null,
    ResultsCount: 3,
    ResultsLimit: 0,
    ResultsTime: 1,
    SearchDesc: '',
    SearchFilters: [],
    ThemeID: 0,
    USIID: 0,
    UpdateUserID: 'CHROMEREG',
    UserID: '',
    SourceUSIID: 0,
    ConvertToUserDisplayTimeZone: false,
  },
  2,
  [],
  true,
];
