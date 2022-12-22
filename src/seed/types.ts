export type OperationSeedResponse = {
  data?: Record<string, unknown>;
  errors?: Record<string, unknown>[];
};

export type NetworkErrorResponse = Record<string, unknown> | string | null;

export type SeededOperationResponse = {
  data?: Record<string, unknown>;
  errors?: object[];
  warnings?: string[];
  statusCode?: number;
};

export type OperationMatchArguments = Record<string, unknown>;

export type SeedOptions = {
  usesLeft?: number;
  partialArgs?: boolean;
  statusCode?: number;
};

export type Seed = {
  operationName: string;
  seedResponse: OperationSeedResponse;
  operationMatchArguments?: OperationMatchArguments;
  options?: SeedOptions;
};
