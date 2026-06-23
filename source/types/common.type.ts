export interface User {
  username: string;
  password: string;
}

export interface SetupData {
  version: string;
}

export interface SessionTokens {
  bearerToken: string | null;
  encUserId: string | null;
}

export interface MomentusAuth {
  bearerToken: string | null;
  salesAiJwt: string | null;
}

export interface TransportColumn {
  ColumnName: string;
  DataType?: string;
  DefaultValue?: unknown;
  ColumnID?: number;
}

export interface TransportRow {
  Values: Record<string, unknown>;
}

export interface TransportTable {
  TransportDataColumns: TransportColumn[];
  TransportDataRows: TransportRow[];
  TableName?: string;
}
