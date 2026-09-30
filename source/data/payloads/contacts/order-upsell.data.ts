/* Captured answer to the OrderUpsell prompt the first Save2 returns: the suggested-upsell table the browser submits back (AdditionalTablesToSave) and its row-change keys (SaveInfo). The suggestion follows from the captured order-form lines, so it is replayed as recorded. */
export const orderUpsellMessageData = () => [
  {
    Key: 'AdditionalTablesToSave',
    Value:
      '{"TransportDataTables":[{"TableName":"ObjectID_2558","TransportDataColumns":[{"ColumnName":"cORG_CODE","DataType":"System.String","DefaultValue":null,"ColumnID":0},{"ColumnName":"cORD_NBR","DataType":"System.Int32","DefaultValue":null,"ColumnID":1},{"ColumnName":"cLEVEL","DataType":"System.Int32","DefaultValue":null,"ColumnID":2},{"ColumnName":"cPARENT_ORD_LINE","DataType":"System.Int32","DefaultValue":null,"ColumnID":3},{"ColumnName":"cORD_LINE","DataType":"System.Int32","DefaultValue":null,"ColumnID":4},{"ColumnName":"cSORT_SEQ","DataType":"System.Int32","DefaultValue":null,"ColumnID":5},{"ColumnName":"cPRICE_LIST","DataType":"System.String","DefaultValue":null,"ColumnID":6},{"ColumnName":"cPR_LIST_DTL","DataType":"System.Int32","DefaultValue":null,"ColumnID":7},{"ColumnName":"cORDER_FORM","DataType":"System.String","DefaultValue":null,"ColumnID":8},{"ColumnName":"cRATE_TYPE","DataType":"System.String","DefaultValue":null,"ColumnID":9},{"ColumnName":"cNEW_RES_TYPE","DataType":"System.String","DefaultValue":null,"ColumnID":10},{"ColumnName":"cRES_CODE","DataType":"System.String","DefaultValue":null,"ColumnID":11},{"ColumnName":"cUNITS_SCHEME_CODE","DataType":"System.String","DefaultValue":null,"ColumnID":12},{"ColumnName":"cRES_QTY","DataType":"System.Decimal","DefaultValue":null,"ColumnID":13},{"ColumnName":"cUOM","DataType":"System.String","DefaultValue":null,"ColumnID":14},{"ColumnName":"cPL_UNIT_CHRG","DataType":"System.Decimal","DefaultValue":null,"ColumnID":15},{"ColumnName":"cDESC","DataType":"System.String","DefaultValue":null,"ColumnID":16},{"ColumnName":"cADD","DataType":"System.String","DefaultValue":null,"ColumnID":17},{"ColumnName":"cITEMS","DataType":"System.String","DefaultValue":null,"ColumnID":18},{"ColumnName":"GrandTotal","DataType":"System.String","DefaultValue":null,"ColumnID":19},{"ColumnName":"COMP_UF_cPL_UNIT_CHRG","DataType":"System.Decimal","DefaultValue":null,"ColumnID":20},{"ColumnName":"cADD__EDIT_SORT","DataType":"System.String","DefaultValue":null,"ColumnID":21},{"ColumnName":"cRES_QTY__EDIT_SORT","DataType":"System.Decimal","DefaultValue":null,"ColumnID":22}],"TransportDataRows":[{"Values":{"0":"10","1":-1,"2":1,"3":0,"4":-101,"5":1,"6":"2022SPL","7":195,"8":"11","9":"AD","10":"3580","11":"3580-210","12":"","13":13,"14":"EA","15":10,"16":"Metropolis Famous Potato Salad","17":"N","18":"","19":null,"20":10,"21":"N","22":13}},{"Values":{"0":"10","1":-1,"2":2,"3":-101,"4":-1102,"5":1,"6":"2022SPL","7":83,"8":"23","9":"AD","10":"3550","11":"3550-003","12":"","13":13,"14":"C12","15":30,"16":"Michelob Beer R Desc","17":"Y","18":null,"19":null,"20":30,"21":"N","22":13}},{"Values":{"0":"10","1":-1,"2":2,"3":-101,"4":-1103,"5":2,"6":"2022SPL","7":188,"8":"11","9":"AD","10":"3710","11":"BAKED","12":"","13":13,"14":"EA","15":5,"16":"Baked Potato","17":"N","18":null,"19":null,"20":5,"21":"N","22":13}},{"Values":{"0":"10","1":-1,"2":2,"3":-101,"4":-1104,"5":3,"6":"2022SPL","7":199,"8":"11","9":"AD","10":"3710","11":"SALAD","12":"","13":13,"14":"EA","15":5,"16":"Tossed Salad","17":"N","18":null,"19":null,"20":5,"21":"N","22":13}}]}]}',
  },
  {
    Key: 'SaveInfo',
    Value: {
      SaveMode: 0,
      Delete: false,
      Tag: {},
      MessageInfoList: [],
      WorkflowToolbarButtonID: 0,
      AddedRowKeys: [],
      ModifiedRowKeys: ['10|1'],
      DeletedRowKeys: [],
      UnchangedRowKeys: [],
      AdditionalTableKeyAddedRowKeys: [
        {
          Key: 'ObjectID_2558',
          Value: [],
        },
      ],
      AdditionalTableKeyModifiedRowKeys: [
        {
          Key: 'ObjectID_2558',
          Value: ['10|-1|-1102'],
        },
      ],
      AdditionalTableKeyDeletedRowKeys: [
        {
          Key: 'ObjectID_2558',
          Value: [],
        },
      ],
      AdditionalTableKeyUnchangedRowKeys: [
        {
          Key: 'ObjectID_2558',
          Value: ['10|-1|-101', '10|-1|-1103', '10|-1|-1104'],
        },
      ],
    },
  },
];
