import { NavScreen } from '../../../utils/exports/types.exp.ts';

/* Top-level nav modules and the window id each opens. AcctDesig-scoped screens (Accounts, Contacts)
   carry the extra list param the app sends; every other screen loads with the standard context. */
export const navScreens: NavScreen[] = [
  {
    label: 'Accounts',
    windowId: 'ES8070',
    listParams: [{ Key: 'AcctDesig', Value: 'C' }],
  },
  {
    label: 'Contacts',
    windowId: 'ES8300',
    listParams: [{ Key: 'AcctDesig', Value: 'C' }],
  },
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

/* GetInitialData2 loads a list screen; per-screen values are the window id, the WindowObjectID
   (correlated from GetWindowInfo), and listParams. Positionals after objectId: saved-view id
   (0 = server default) then three reserved zeros. */
export const listInitialDataPayload = (screen: NavScreen, objectId: number) => [
  listContext(screen, objectId),
  screen.windowId,
  0,
  objectId,
  0,
  0,
  0,
  0,
  listView,
  listSearch,
  [],
  true,
];

/* Org the pool accounts belong to; GetWindowInfo doesn't report it, so it's a shared constant. */
const ORG_CODE = '10';

const listContext = (screen: NavScreen, objectId: number) => [
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

/* View and search are sent empty so the server resolves the user's default view. */
const listView = {
  ID: 0,
  ThemeID: 0,
  UserID: '',
  ObjectID: 0,
  ViewDesc: '',
  SearchID: 0,
  Default: 'N',
  EnterUserID: '',
  UpdateUserID: '',
  USIID: 0,
  SubTotalColumns: '',
  GrandTotalColumns: '',
  ShowGroupCounts: false,
  ViewType: 0,
  ViewColumns: [],
  OrgCode: '',
  GrandTotalRowCollapsed: false,
  CustomXML: '',
  AccessType: 1,
  RoleIDs: '',
  ContextObjectIDs: '',
  ViewGroups: [],
  UseCardList: false,
  SourceUSIID: 0,
};

const listSearch = {
  AutoRefresh: 'Y',
  EnterUserID: '',
  FilterCriteria: '',
  ID: 0,
  ObjectID: 0,
  OrgCode: null,
  ResultsCount: 0,
  ResultsLimit: 0,
  ResultsTime: 0,
  SearchDesc: '',
  SearchFilters: [],
  ThemeID: 0,
  USIID: 0,
  UpdateUserID: '',
  UserID: '',
  SourceUSIID: 0,
  ConvertToUserDisplayTimeZone: false,
};
