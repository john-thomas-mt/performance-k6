/* Issues the approved purchase order through the IssuePurchaseOrder server action (object 606); RefreshDependentKey is the client epoch. */
export const purchaseOrderIssuePayload = (wdwid: string, poNbr: string) => [
  '10',
  606,
  0,
  0,
  4,
  0,
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'SelectedRowKeys',
      Value: `["10|${poNbr}"]`,
    },
    {
      Key: 'wdwid',
      Value: wdwid,
    },
    {
      Key: 'ReportList',
      Value: 1089,
    },
    {
      Key: 'ReportSequence',
      Value: 182,
    },
    {
      Key: 'WindowObjectID',
      Value: 606,
    },
    {
      Key: 'RefreshDependentKey',
      Value: Date.now(),
    },
    {
      Key: 'WdwType',
      Value: 4,
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
      Key: 'ReportType',
      Value: 'RP',
    },
    {
      Key: 'ReportID',
      Value: 'CPO102',
    },
    {
      Key: 'ReportTool',
      Value: 'C',
    },
    {
      Key: 'ReportOrigin',
      Value: 'U',
    },
    {
      Key: 'USIRefNbr',
      Value: 5822,
    },
    {
      Key: 'ReportName',
      Value: 'Purchase Order',
    },
    {
      Key: 'AllowReportExport',
      Value: 'ALL',
    },
    {
      Key: 'ReportObjectID',
      Value: 879,
    },
    {
      Key: 'ReportPromptID',
      Value: 'wdPurchaseOrder',
    },
    {
      Key: 'AccessResult',
      Value: 0,
    },
    {
      Key: 'SaveSettingsViewID',
      Value: 34460,
    },
    {
      Key: 'SaveSettingsViewObject',
      Value:
        '{"dm1":34460,"dm10":"\\/Date(1627407174627-0500)\\/","dm11":"USIADMIN","dm12":0,"dm13":"","dm14":"","dm15":false,"dm16":6,"dm17":[],"dm18":"10","dm19":false,"dm2":0,"dm20":"182","dm21":1,"dm22":"","dm23":"","dm24":[],"dm25":false,"dm26":false,"dm27":false,"dm3":"USIADMIN","dm30":false,"dm31":false,"dm32":false,"dm33":0,"dm4":606,"dm5":"Purchase Order","dm6":40792,"dm7":"N","dm8":"\\/Date(1627407174627-0500)\\/","dm9":"USIADMIN"}',
    },
    {
      Key: 'SaveSettingsSearchObject',
      Value:
        '{"AutoRefresh":"N","ConvertToUserDisplayTimeZone":false,"EnterUserID":"USIADMIN","FilterCriteria":"","ID":40792,"ObjectID":606,"OrgCode":"10","ResultsCount":0,"ResultsLimit":0,"ResultsTime":0,"SearchDesc":"","SearchFilters":[{"AbsoluteValue":false,"ConvertedToUserDisplayTimeZone":false,"CustomXML":"","EnterUserID":"USIADMIN","FilterType":0,"ForceUnparameterized":false,"ID":17978,"LikeType":0,"ObjectColumnID":56530,"ObjectID":606,"Operand":"=","Operand2":"","SearchID":40792,"ThemeID":0,"ToUpper":"N","TrailingOperand":"AND","UpdateUserID":"USIADMIN","UsedInList":false,"UsedInList2":false,"UserID":"USIADMIN","Value":"P","Value2":""},{"AbsoluteValue":false,"ConvertedToUserDisplayTimeZone":false,"CustomXML":"","EnterUserID":"USIADMIN","FilterType":0,"ForceUnparameterized":false,"ID":17979,"LikeType":0,"ObjectColumnID":56572,"ObjectID":606,"Operand":"=","Operand2":"","SearchID":40792,"ThemeID":0,"ToUpper":"N","TrailingOperand":"AND","UpdateUserID":"USIADMIN","UsedInList":false,"UsedInList2":false,"UserID":"USIADMIN","Value":"N","Value2":""}],"SourceUSIID":0,"ThemeID":0,"USIID":0,"UpdateUserID":"USIADMIN","UserID":"USIADMIN"}',
    },
  ],
  'IssuePurchaseOrder',
  [
    {
      Key: 'OrgCode',
      Value: '10',
    },
    {
      Key: 'SelectedRowKeys',
      Value: `["10|${poNbr}"]`,
    },
    {
      Key: 'wdwid',
      Value: wdwid,
    },
    {
      Key: 'ReportList',
      Value: 1089,
    },
    {
      Key: 'ReportSequence',
      Value: 182,
    },
    {
      Key: 'WindowObjectID',
      Value: 606,
    },
    {
      Key: 'RefreshDependentKey',
      Value: Date.now(),
    },
    {
      Key: 'WdwType',
      Value: 4,
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
      Key: 'ReportType',
      Value: 'RP',
    },
    {
      Key: 'ReportID',
      Value: 'CPO102',
    },
    {
      Key: 'ReportTool',
      Value: 'C',
    },
    {
      Key: 'ReportOrigin',
      Value: 'U',
    },
    {
      Key: 'USIRefNbr',
      Value: 5822,
    },
    {
      Key: 'ReportName',
      Value: 'Purchase Order',
    },
    {
      Key: 'AllowReportExport',
      Value: 'ALL',
    },
    {
      Key: 'ReportObjectID',
      Value: 879,
    },
    {
      Key: 'ReportPromptID',
      Value: 'wdPurchaseOrder',
    },
    {
      Key: 'AccessResult',
      Value: 0,
    },
    {
      Key: 'SaveSettingsViewID',
      Value: 34460,
    },
    {
      Key: 'SaveSettingsViewObject',
      Value:
        '{"dm1":34460,"dm10":"\\/Date(1627407174627-0500)\\/","dm11":"USIADMIN","dm12":0,"dm13":"","dm14":"","dm15":false,"dm16":6,"dm17":[],"dm18":"10","dm19":false,"dm2":0,"dm20":"182","dm21":1,"dm22":"","dm23":"","dm24":[],"dm25":false,"dm26":false,"dm27":false,"dm3":"USIADMIN","dm30":false,"dm31":false,"dm32":false,"dm33":0,"dm4":606,"dm5":"Purchase Order","dm6":40792,"dm7":"N","dm8":"\\/Date(1627407174627-0500)\\/","dm9":"USIADMIN"}',
    },
    {
      Key: 'SaveSettingsSearchObject',
      Value:
        '{"AutoRefresh":"N","ConvertToUserDisplayTimeZone":false,"EnterUserID":"USIADMIN","FilterCriteria":"","ID":40792,"ObjectID":606,"OrgCode":"10","ResultsCount":0,"ResultsLimit":0,"ResultsTime":0,"SearchDesc":"","SearchFilters":[{"AbsoluteValue":false,"ConvertedToUserDisplayTimeZone":false,"CustomXML":"","EnterUserID":"USIADMIN","FilterType":0,"ForceUnparameterized":false,"ID":17978,"LikeType":0,"ObjectColumnID":56530,"ObjectID":606,"Operand":"=","Operand2":"","SearchID":40792,"ThemeID":0,"ToUpper":"N","TrailingOperand":"AND","UpdateUserID":"USIADMIN","UsedInList":false,"UsedInList2":false,"UserID":"USIADMIN","Value":"P","Value2":""},{"AbsoluteValue":false,"ConvertedToUserDisplayTimeZone":false,"CustomXML":"","EnterUserID":"USIADMIN","FilterType":0,"ForceUnparameterized":false,"ID":17979,"LikeType":0,"ObjectColumnID":56572,"ObjectID":606,"Operand":"=","Operand2":"","SearchID":40792,"ThemeID":0,"ToUpper":"N","TrailingOperand":"AND","UpdateUserID":"USIADMIN","UsedInList":false,"UsedInList2":false,"UserID":"USIADMIN","Value":"N","Value2":""}],"SourceUSIID":0,"ThemeID":0,"USIID":0,"UpdateUserID":"USIADMIN","UserID":"USIADMIN"}',
    },
  ],
];
