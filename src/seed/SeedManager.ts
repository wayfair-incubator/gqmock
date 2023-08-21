import Joi from 'joi';
import deepMerge from '../utilities/deepMerge';
import {
  NetworkErrorResponse,
  OperationMatchArguments,
  OperationSeedResponse,
  Seed,
  SeededOperationResponse,
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
    statusCode: number;
  };
  seedResponse: OperationSeedResponse;
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
          operationName: Joi.string().required(),
          seedResponse: Joi.object({
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
        const networkErrorSeedSchema = Joi.object({
          operationName: Joi.string().required(),
          seedResponse: Joi.alternatives()
            .try(Joi.object(), Joi.string(), null)
            .required(),
          operationMatchArguments: Joi.object(),
        });

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
    {usesLeft, partialArgs, statusCode}: SeedOptions = {}
  ): void {
    this.validateSequenceId(sequenceId);
    this.validateSeed(type, seed);

    const {operationName, seedResponse, operationMatchArguments = {}} = seed;
    this.seedCache[sequenceId] ??= {};
    this.seedCache[sequenceId][operationName] ??= [];
    this.seedCache[sequenceId][operationName].push({
      type,
      seedResponse,
      operationMatchArguments,
      options: {
        usesLeft: usesLeft || -1, // -1 means the seed will never be removed
        partialArgs: partialArgs || false,
        statusCode: statusCode || (type === SeedType.NetworkError ? 500 : 200),
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

  private matchArguments(
    source: Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    target: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    const argsMatch = Object.entries(source).every(
      ([argumentName, argumentValue]) => {
        // null is an object, exclude it from this check
        if (typeof argumentValue === 'object' && argumentValue != null) {
          return this.matchArguments(argumentValue, target[argumentName]);
        }
        return isEqual(target[argumentName], argumentValue);
      }
    );

    return argsMatch;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private argumentCount(args: Record<string, any>) {
    return Object.entries(args).reduce((acc, [, value]) => {
      // null is an object,  exclude it from this check
      if (typeof value === 'object' && value != null) {
        return acc + this.argumentCount(value) + 1;
      }

      return acc + 1;
    }, 0);
  }

  private findSeed(
    sequenceId,
    operationName,
    operationArguments
  ): {
    seed: SeedCacheInstance | Record<string, never>;
    seedIndex: number;
  } {
    if (
      sequenceId === undefined ||
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
        const argsMatch = this.matchArguments(
          seedDefinition.operationMatchArguments,
          operationArguments
        );

        if (seedDefinition.options.partialArgs) {
          return argsMatch;
        }

        const sameNumberOfArgs =
          this.argumentCount(operationArguments) ===
          this.argumentCount(seedDefinition.operationMatchArguments);

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
    operationResponse: SeededOperationResponse | NetworkErrorResponse;
    statusCode: number;
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
            validSeed.seedResponse.errors || operationMock.errors || [];
          const seededMock = await deepMerge(
            {data: operationMock.data || null},
            {data: validSeed.seedResponse.data || {}},
            {
              apolloServerManager,
              query,
              operationName,
            }
          );
          this.maybeDiscardSeed(sequenceId, operationName, seedIndex);
          return {
            operationResponse: {
              data: seededMock.data.data as Record<string, unknown>,
              ...(errors.length && {errors}),
              ...(seededMock.warnings.length && {
                warnings: seededMock.warnings,
              }),
            },
            statusCode: validSeed.options.statusCode,
          };
        case SeedType.NetworkError:
          this.maybeDiscardSeed(sequenceId, operationName, seedIndex);
          return Promise.resolve({
            operationResponse: validSeed.seedResponse,
            statusCode: validSeed.options.statusCode,
          });
      }
    }

    return {
      operationResponse: operationMock,
      statusCode: 200,
    };
  }
}
