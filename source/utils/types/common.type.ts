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

export type TransportColumn = {
  ColumnName: string;
  DataType?: string;
  DefaultValue?: unknown;
  ColumnID?: number;
};

export type TransportRow = {
  Values: { [columnIndex: string]: unknown };
};

export type TransportTable = {
  TransportDataColumns: TransportColumn[];
  TransportDataRows: TransportRow[];
  TableName?: string;
};
