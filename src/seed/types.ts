export type OperationSeedResponse = {
  data?: Record<string, unknown>;
  errors?: Record<string, unknown>[];
};

export type OperationMatchArguments = Record<string, unknown>;

export type SeedOptions = {
  usesLeft?: number;
  partialArgs?: boolean;
};

export type Seed = {
  operationName: string;
  operationSeedResponse: OperationSeedResponse;
  operationMatchArguments?: OperationMatchArguments;
  options?: SeedOptions;
};
