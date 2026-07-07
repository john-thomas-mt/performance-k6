export type User = {
  username: string;
  password: string;
};

export type SetupData = {
  version: string;
};

export type SessionTokens = {
  bearerToken: string | null;
  encUserId: string | null;
};

export type MomentusAuth = {
  bearerToken: string | null;
  salesAiJwt: string | null;
};

export type JsonScalar = string | number | boolean | null;

export type TransportValues = { [columnIndex: string]: JsonScalar };

export type TransportColumn = {
  ColumnName: string;
  DataType?: string;
  DefaultValue?: JsonScalar;
  ColumnID?: number;
};

export type TransportRow = {
  Values: TransportValues;
};

export type TransportTable = {
  TransportDataColumns: TransportColumn[];
  TransportDataRows: TransportRow[];
  TableName?: string;
};

export type TransportEnvelope = {
  TransportDataTables?: TransportTable[];
};
