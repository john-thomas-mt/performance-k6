import { NavScreen } from '../../utils/exports/types.exp.ts';

// Org the pool accounts belong to; the same for every user in users.data.ts. GetWindowInfo does
// not report it, so it is a shared constant rather than a correlated value.
const ORG_CODE = '10';

// Top-level navigation modules and the window id each one opens (captured from the live nav menu).
// AcctDesig-scoped screens (Accounts, Contacts) carry the extra list param the app sends for them;
// every other screen loads with the standard context alone.
export const navScreens: NavScreen[] = [
  { label: 'Accounts', windowId: 'ES8070', listParams: [{ Key: 'AcctDesig', Value: 'C' }] },
  { label: 'Contacts', windowId: 'ES8300', listParams: [{ Key: 'AcctDesig', Value: 'C' }] },
  { label: 'Events', windowId: 'EM8059' },
  { label: 'Contracts', windowId: 'CA2168' },
  { label: 'Service Orders', windowId: 'EM8066' },
  { label: 'Work Orders', windowId: 'EM9564' },
  { label: 'Activities', windowId: 'CF8161' },
  { label: 'Event Opportunities', windowId: 'ES8737' },
  { label: 'Purchase Orders', windowId: 'PO7906' },
  { label: 'Requisitions', windowId: 'PO7909' },
  { label: 'Invoices', windowId: 'AR8157' },
];

// GetInitialData2 loads a list screen. The payload is almost entirely defaults; the only values that
// vary per screen are the window id, the WindowObjectID (correlated from GetWindowInfo), and the
// screen-specific listParams. The view/search objects are sent empty so the server resolves the
// user's default view (the captured saved-view id was per-user, so it is deliberately left at 0).
export function listInitialDataPayload(screen: NavScreen, objectId: number): unknown[] {
  const context: NavScreen['listParams'] = [
    { Key: 'OrgCode', Value: ORG_CODE },
    { Key: 'WindowObjectID', Value: objectId },
    { Key: 'wdwid', Value: screen.windowId },
    { Key: 'WdwType', Value: 1 },
    { Key: 'wdwMode', Value: 0 },
    { Key: 'RemoveEditLayoutLink', Value: false },
    { Key: 'ContextObjectID', Value: 0 },
    ...(screen.listParams ?? []),
    { Key: 'MenuType', Value: 1 },
    { Key: 'MenuObjectID', Value: 0 },
    { Key: 'MenuContextObjectID', Value: 0 },
  ];

  const view = {
    ID: 0, ThemeID: 0, UserID: '', ObjectID: 0, ViewDesc: '', SearchID: 0, Default: 'N',
    EnterUserID: '', UpdateUserID: '', USIID: 0, SubTotalColumns: '', GrandTotalColumns: '',
    ShowGroupCounts: false, ViewType: 0, ViewColumns: [], OrgCode: '', GrandTotalRowCollapsed: false,
    CustomXML: '', AccessType: 1, RoleIDs: '', ContextObjectIDs: '', ViewGroups: [], UseCardList: false,
    SourceUSIID: 0,
  };

  const search = {
    AutoRefresh: 'Y', EnterUserID: '', FilterCriteria: '', ID: 0, ObjectID: 0, OrgCode: null,
    ResultsCount: 0, ResultsLimit: 0, ResultsTime: 0, SearchDesc: '', SearchFilters: [], ThemeID: 0,
    USIID: 0, UpdateUserID: '', UserID: '', SourceUSIID: 0, ConvertToUserDisplayTimeZone: false,
  };

  // Positionals after objectId: saved-view id (0 = server resolves the user's default) then three
  // reserved zeros, matching the captured request shape exactly.
  return [context, screen.windowId, 0, objectId, 0, 0, 0, 0, view, search, [], true];
}
