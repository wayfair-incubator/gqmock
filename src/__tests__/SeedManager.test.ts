import SeedManager, {SeedType} from '../seed/SeedManager';
import ApolloServerManager from '../ApolloServerManager';

describe('Seed Manager', () => {
  let seedManager;
  let apolloServerManager;
  beforeEach(() => {
    seedManager = new SeedManager();
    apolloServerManager = new ApolloServerManager();
  });

  describe('validateSequenceId', function () {
    it('should throw at validation if sequenceId is missing', () => {
      expect(() => {
        seedManager.validateSequenceId();
      }).toThrow('sequenceId is required');
    });

    it('should throw at validation if sequenceId is not a string', () => {
      const sequenceId = 3;
      expect(() => {
        seedManager.validateSequenceId(sequenceId);
      }).toThrow('sequenceId is required');
    });
  });

  describe('registerSeed', function () {
    it('should register a seed with type "operation"', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: 'abc'},
      };
      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed);

      expect(
        seedManager.findSeed(
          sequenceId,
          seed.operationName,
          seed.operationMatchArguments
        ).seed
      ).toEqual({
        type,
        seedResponse: seed.seedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
          statusCode: 200,
        },
      });
    });

    it('should register a seed with type "network-error', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {message: 'this will cause an network error'},
        operationMatchArguments: {sku: 'network error'},
      };
      const type = SeedType.NetworkError;

      seedManager.registerSeed(sequenceId, type, seed);

      expect(
        seedManager.findSeed(
          sequenceId,
          seed.operationName,
          seed.operationMatchArguments
        ).seed
      ).toEqual({
        type,
        seedResponse: seed.seedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
          statusCode: 500,
        },
      });
    });

    it('should throw when trying to register a seed with an unknown type', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {message: 'this will cause an network error'},
        operationMatchArguments: {sku: 'network error'},
      };
      const type = 'bad-seed-type';

      expect(() => {
        seedManager.registerSeed(sequenceId, type, seed);
      }).toThrow('Unable to validate seed: Unknown seed type');
    });

    it('should allow to register a seed without matchArguments', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {},
      };
      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed);

      expect(
        seedManager.findSeed(
          sequenceId,
          seed.operationName,
          seed.operationMatchArguments
        ).seed
      ).toEqual({
        type,
        seedResponse: seed.seedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
          statusCode: 200,
        },
      });
    });

    it('should throw when seed does not have the correct shape', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {
          data: {product: 'my product'},
          errors: [],
          extraKey: 'this should not be here',
        },
        operationMatchArguments: {sku: 'network error'},
      };
      const type = SeedType.Operation;

      expect(() => {
        seedManager.registerSeed(sequenceId, type, seed);
      }).toThrow('"seedResponse.extraKey" is not allowed');
    });
  });

  describe('findSeed', function () {
    it('should return {} if operation does not have any seeds registered', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: 'abc'},
      };

      expect(
        seedManager.findSeed(sequenceId, seed.operationName, {
          sku: 'unknown sku',
        }).seed
      ).toEqual({});
    });

    it('should return {} if seed for a given operation and matchArguments is not found', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: 'abc'},
      };
      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed);
      expect(
        seedManager.findSeed(sequenceId, seed.operationName, {
          sku: 'unknown sku',
        }).seed
      ).toEqual({});
    });

    it('should allow partial args matching', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: 'abc', anotherArg: 'test'},
      };
      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed, {partialArgs: true});
      expect(
        seedManager.findSeed(sequenceId, seed.operationName, {
          sku: 'abc',
        }).seed
      ).toEqual({
        type,
        seedResponse: seed.seedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: true,
          statusCode: 200,
        },
      });
    });

    it('should allow deep args matching', () => {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: [{type: '1'}, {type: '2'}]},
      };
      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed);
      expect(
        seedManager.findSeed(sequenceId, seed.operationName, {
          sku: [{type: '1'}, {type: '2'}],
        }).seed
      ).toEqual({
        type,
        seedResponse: seed.seedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
          statusCode: 200,
        },
      });
    });
  });

  describe('mergeOperationResponse', function () {
    it('should not merge anything if seed is not found', async () => {
      const sequenceId = 'sequenceId';
      const operationMock = {
        data: {
          product: 'Hello World',
        },
      };

      expect(
        await seedManager.mergeOperationResponse({
          operationName: 'operationA',
          variables: {},
          operationMock,
          sequenceId,
          apolloServerManager,
        })
      ).toEqual({
        operationResponse: operationMock,
        statusCode: 200,
      });
    });

    it('should merge operation response with operation type seeds', async () => {
      const sequenceId = 'sequenceId';
      const operationMock = {
        data: {
          product: 'Hello World',
          dimensions: {
            width: 100,
            height: 200,
          },
        },
      };
      const seed = {
        operationName: 'operationA',
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: 'abc'},
      };
      const expectedOperationResult = {
        operationResponse: {
          data: {
            product: seed.seedResponse.data.product,
            dimensions: operationMock.data.dimensions,
          },
        },
        statusCode: 200,
      };

      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed);
      const mergeResult = await seedManager.mergeOperationResponse({
        operationName: seed.operationName,
        variables: seed.operationMatchArguments,
        operationMock,
        sequenceId,
        apolloServerManager,
      });
      expect(mergeResult).toEqual(expectedOperationResult);
    });

    it('should prioritize seed errors over mock errors', async () => {
      const sequenceId = 'sequenceId';
      const operationMock = {
        errors: [
          {
            message: 'error returned by apollo server',
          },
        ],
      };
      const seed = {
        operationName: 'operationA',
        seedResponse: {
          errors: [{message: 'error registered by the user'}],
        },
        operationMatchArguments: {sku: 'abc'},
      };
      const expectedOperationResult = {
        operationResponse: {
          data: {},
          errors: seed.seedResponse.errors,
        },
        statusCode: 500,
      };

      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed, {statusCode: 500});
      const mergeResult = await seedManager.mergeOperationResponse({
        operationName: seed.operationName,
        variables: seed.operationMatchArguments,
        operationMock,
        sequenceId,
        apolloServerManager,
      });
      expect(mergeResult).toEqual(expectedOperationResult);
    });

    it('should merge operation response with network-error type seeds', async () => {
      const sequenceId = 'sequenceId';
      const operationMock = {
        errors: [
          {
            message: 'error returned by apollo server',
          },
        ],
      };
      const seed = {
        operationName: 'operationA',
        seedResponse: {message: 'this will throw an error'},
        operationMatchArguments: {sku: 'unknown sku'},
      };
      const type = SeedType.NetworkError;

      const expectedResponse = {
        operationResponse: seed.seedResponse,
        statusCode: 500,
      };

      seedManager.registerSeed(sequenceId, type, seed, {statusCode: 500});
      const mergeResult = await seedManager.mergeOperationResponse({
        operationName: seed.operationName,
        variables: seed.operationMatchArguments,
        operationMock,
        sequenceId,
        schema: null,
        apolloServerManager,
      });
      expect(mergeResult).toEqual(expectedResponse);
    });

    it('should discard seeds after being used the number of times provided at registration', async () => {
      const sequenceId = 'sequenceId';
      const operationMock = {
        data: {
          product: 'Hello World',
          dimensions: {
            width: 100,
            height: 200,
          },
        },
      };

      const operationName = 'operationA';
      const operationMatchArguments = {sku: 'abc'};
      const firstSeed = {
        operationName,
        seedResponse: {data: {product: 'my product'}},
        operationMatchArguments,
      };
      const secondSeed = {
        operationName,
        seedResponse: {data: {product: 'second product'}},
        operationMatchArguments,
      };
      const firstSeedExpectedOperationResult = {
        data: {
          product: firstSeed.seedResponse.data.product,
          dimensions: operationMock.data.dimensions,
        },
      };

      const secondSeedExpectedOperationResult = {
        data: {
          product: secondSeed.seedResponse.data.product,
          dimensions: operationMock.data.dimensions,
        },
      };

      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, firstSeed, {usesLeft: 2});
      seedManager.registerSeed(sequenceId, type, secondSeed);

      const {operationResponse: firstMergeResult} =
        await seedManager.mergeOperationResponse({
          operationName,
          variables: operationMatchArguments,
          operationMock,
          sequenceId,
          apolloServerManager,
        });
      expect(firstMergeResult).toEqual(firstSeedExpectedOperationResult);
      const {operationResponse: secondMergeResult} =
        await seedManager.mergeOperationResponse({
          operationName,
          variables: operationMatchArguments,
          operationMock,
          sequenceId,
          apolloServerManager,
        });
      expect(secondMergeResult).toEqual(firstSeedExpectedOperationResult);
      // first seed should be discarded now
      const {operationResponse: thirdMergeResult} =
        await seedManager.mergeOperationResponse({
          operationName,
          variables: operationMatchArguments,
          operationMock,
          sequenceId,
          apolloServerManager,
        });
      expect(thirdMergeResult).toEqual(secondSeedExpectedOperationResult);
      const {operationResponse: fourthMergeResult} =
        await seedManager.mergeOperationResponse({
          operationName,
          variables: operationMatchArguments,
          operationMock,
          sequenceId,
          apolloServerManager,
        });
      expect(fourthMergeResult).toEqual(secondSeedExpectedOperationResult);
    });
  });
});
