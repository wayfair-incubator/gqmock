import Joi from 'joi';
import deepMerge from '../utilities/deepMerge';
import {
  OperationMatchArguments,
  OperationSeedResponse,
  Seed,
  SeedOptions,
} from './types';
import GraphqlMockingContextLogger from '../utilities/Logger';
import {isEqual} from 'lodash';
import ApolloServerManager from '../ApolloServerManager';

export enum SeedType {
  Operation = 'operation',
  NetworkError = 'network-error',
}

type SeedCacheInstance = {
  type: SeedType;
  options: {
    usesLeft: number;
    partialArgs: boolean;
  };
  operationSeedResponse: OperationSeedResponse;
  operationMatchArguments: OperationMatchArguments;
};

export default class SeedManager {
  private seedCache: Record<string, Record<string, SeedCacheInstance[]>> = {};

  private validateSequenceId(sequenceId: string): boolean {
    if (!sequenceId || typeof sequenceId !== 'string') {
      throw new Error('sequenceId is required');
    }

    return true;
  }

  private validateSeed(type: SeedType, seed: Seed): boolean {
    let error;

    switch (type) {
      case SeedType.Operation:
        const operationSeedSchema = Joi.object({
          type: Joi.string().valid(...Object.values(SeedType)),
          operationName: Joi.string().required(),
          operationSeedResponse: Joi.object({
            data: Joi.object(),
            errors: Joi.array().items(Joi.string(), Joi.object()),
          })
            .or('data', 'errors')
            .required(),
          operationMatchArguments: Joi.object(),
        }).required();

        ({error} = operationSeedSchema.validate(seed));
        break;
      case SeedType.NetworkError:
        const networkErrorSeedSchema = Joi.object().required();

        ({error} = networkErrorSeedSchema.validate(seed));
        break;
      default:
        throw new Error('Unable to validate seed: Unknown seed type');
    }

    if (error?.message) {
      throw new Error(error.message);
    }

    return true;
  }

  registerSeed(
    sequenceId: string,
    type: SeedType,
    seed: Seed,
    {usesLeft, partialArgs}: SeedOptions = {}
  ): void {
    this.validateSequenceId(sequenceId);
    this.validateSeed(type, seed);

    const {
      operationName,
      operationSeedResponse,
      operationMatchArguments = {},
    } = seed;
    this.seedCache[sequenceId] ??= {};
    this.seedCache[sequenceId][operationName] ??= [];
    this.seedCache[sequenceId][operationName].push({
      type,
      operationSeedResponse,
      operationMatchArguments,
      options: {
        usesLeft: usesLeft || -1, // -1 means the seed will never be removed
        partialArgs: partialArgs || false,
      },
    });
  }

  private maybeDiscardSeed(sequenceId, operationName, seedIndex): void {
    const seed = this.seedCache[sequenceId][operationName][seedIndex];
    seed.options.usesLeft -= 1;
    if (seed.options.usesLeft === 0) {
      this.seedCache[sequenceId][operationName].splice(seedIndex, 1);
    }
  }

  private findSeed(
    sequenceId,
    operationName,
    operationArguments
  ): {
    seed: SeedCacheInstance | Record<string, never>;
    seedIndex: number;
  } {
    this.validateSequenceId(sequenceId);

    if (
      !this.seedCache[sequenceId] ||
      !this.seedCache[sequenceId][operationName]
    ) {
      GraphqlMockingContextLogger.info(
        `🟡 no matching seed found for operationName: ${operationName}`,
        sequenceId
      );
      return {
        seed: {},
        seedIndex: -1,
      };
    }

    const seedIndex = this.seedCache[sequenceId][operationName].findIndex(
      (seedDefinition) => {
        const argsMatch = Object.entries(operationArguments).every(
          ([argumentName, argumentValue]) => {
            return (
              seedDefinition.operationMatchArguments &&
              isEqual(
                seedDefinition.operationMatchArguments[argumentName],
                argumentValue
              )
            );
          }
        );

        if (seedDefinition.options.partialArgs) {
          return argsMatch;
        }

        const sameNumberOfArgs =
          Object.entries(operationArguments).length ===
          Object.entries(seedDefinition.operationMatchArguments).length;

        return argsMatch && sameNumberOfArgs;
      }
    );

    const seed = this.seedCache[sequenceId][operationName][seedIndex] || {};

    if (seedIndex === -1) {
      GraphqlMockingContextLogger.info(
        `🟡 matching seed found but operation arguments: ${JSON.stringify(
          operationArguments,
          null,
          2
        )} are not a match `,
        sequenceId
      );
    } else {
      GraphqlMockingContextLogger.info(`🟢 found matching seed`, sequenceId);
    }

    return {
      seed,
      seedIndex,
    };
  }

  async mergeOperationResponse({
    operationName,
    variables,
    operationMock,
    sequenceId,
    apolloServerManager,
    query,
  }: {
    operationName: string;
    variables: Record<string, unknown>;
    operationMock: {data: Record<string, unknown>; errors: object[]};
    sequenceId: string;
    apolloServerManager: ApolloServerManager;
    query: string;
  }): Promise<{
    data: Record<string, unknown>;
    errors?: object[];
    warnings?: string[];
  }> {
    const {seed, seedIndex} = this.findSeed(
      sequenceId,
      operationName,
      variables
    );
    if (Object.entries(seed).length) {
      const validSeed = seed as SeedCacheInstance;
      switch (validSeed.type) {
        case SeedType.Operation:
          const errors =
            validSeed.operationSeedResponse.errors ||
            operationMock.errors ||
            [];
          const seededMock = await deepMerge(
            {data: operationMock.data || null},
            {data: validSeed.operationSeedResponse.data || {}},
            {apolloServerManager, query, operationName}
          );
          this.maybeDiscardSeed(sequenceId, operationName, seedIndex);
          return {
            data: seededMock.data.data as Record<string, unknown>,
            ...(errors.length && {errors}),
            ...(seededMock.warnings.length && {warnings: seededMock.warnings}),
          };
        case SeedType.NetworkError:
          this.maybeDiscardSeed(sequenceId, operationName, seedIndex);
          return {
            data: validSeed.operationSeedResponse,
          };
      }
    }

    return operationMock;
  }
}
