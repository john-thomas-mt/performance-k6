/* Supplier lookup combo on the Add Purchase Order form (combo 3, field PO100_SUPPLIER), limited to supplier and payee designations as recorded. */
export const purchaseOrderSupplierSearchPayload = (supplierName: string) => [
  '10',
  3,
  612,
  2788,
  supplierName,
  [
    { Key: 'OrgCode', Value: '10' },
    { Key: 'SearchCompanyName', Value: 'N' },
    { Key: 'AcctDesig', Value: 'S,P' },
  ],
  201,
  '',
  0,
  0,
  true,
];

/* Records the picked supplier in the combo's recently-used list, as the browser does on selection. */
export const purchaseOrderSupplierRecentlyUsedPayload = (supplierKey: string) => ['10', 3, 612, null, [supplierKey]];

/* Department lookup combo (combo 71, field PO100_DEPT). The recording types BIL, the billing department, for every order, and that term is kept as captured. */
export const purchaseOrderDepartmentSearchPayload = () => [
  '10',
  71,
  0,
  2787,
  'BIL',
  [{ Key: 'OrgCode', Value: '10' }],
  201,
  "EV065_STATUS = 'A' AND EV065_POR_DPT_STS = 'A'",
  0,
  0,
  true,
];

/* Item lookup combo on the Add PO Item form (combo 334, field PO101_ITEM). AddNonInvWildcards makes the server list the @NONINVENTORY rows first, so the wrapper skips them. */
export const purchaseOrderItemSearchPayload = (itemName: string) => [
  '10',
  334,
  0,
  3358,
  itemName,
  [
    { Key: 'OrgCode', Value: '10' },
    { Key: 'AddNonInvWildcards', Value: true },
    { Key: 'InvItemStatus', Value: 'A' },
  ],
  201,
  "IN100_STATUS = 'A' ",
  0,
  0,
  true,
];

/* Records the picked item in the combo's recently-used list, as the browser does on selection. */
export const purchaseOrderItemRecentlyUsedPayload = (itemKey: string) => ['10', 334, 0, null, [itemKey]];
