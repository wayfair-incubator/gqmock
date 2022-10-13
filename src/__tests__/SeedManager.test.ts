import SeedManager, {SeedType} from '../seed/SeedManager';

describe('Seed Manager', () => {
  let seedManager;
  beforeEach(() => {
    seedManager = new SeedManager();
  });

  describe('validateSequenceId', function () {
    it('should throw at validation if sequenceId is missing', function () {
      expect(() => {
        seedManager.validateSequenceId();
      }).toThrow('sequenceId is required');
    });

    it('should throw at validation if sequenceId is not a string', function () {
      const sequenceId = 3;
      expect(() => {
        seedManager.validateSequenceId(sequenceId);
      }).toThrow('sequenceId is required');
    });
  });

  describe('registerSeed', function () {
    it('should register a seed with type "operation"', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {data: {product: 'my product'}},
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
        operationSeedResponse: seed.operationSeedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
        },
      });
    });

    it('should register a seed with type "network-error', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {message: 'this will cause an network error'},
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
        operationSeedResponse: seed.operationSeedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
        },
      });
    });

    it('should throw when trying to register a seed with an unknown type', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {message: 'this will cause an network error'},
        operationMatchArguments: {sku: 'network error'},
      };
      const type = 'bad-seed-type';

      expect(() => {
        seedManager.registerSeed(sequenceId, type, seed);
      }).toThrow('Unable to validate seed: Unknown seed type');
    });

    it('should allow to register a seed without matchArguments', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {data: {product: 'my product'}},
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
        operationSeedResponse: seed.operationSeedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
        },
      });
    });

    it('should throw when seed does not have the correct shape', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {
          data: {product: 'my product'},
          errors: [],
          extraKey: 'this should not be here',
        },
        operationMatchArguments: {sku: 'network error'},
      };
      const type = SeedType.Operation;

      expect(() => {
        seedManager.registerSeed(sequenceId, type, seed);
      }).toThrow('"operationSeedResponse.extraKey" is not allowed');
    });
  });

  describe('findSeed', function () {
    it('should return {} if operation does not have any seeds registered', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: 'abc'},
      };

      expect(
        seedManager.findSeed(sequenceId, seed.operationName, {
          sku: 'unknown sku',
        }).seed
      ).toEqual({});
    });

    it('should return {} if seed for a given operation and matchArguments is not found', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {data: {product: 'my product'}},
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

    it('should allow partial args matching', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {data: {product: 'my product'}},
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
        operationSeedResponse: seed.operationSeedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: true,
        },
      });
    });

    it('should allow deep args matching', function () {
      const sequenceId = 'sequenceId';
      const seed = {
        operationName: 'operationA',
        operationSeedResponse: {data: {product: 'my product'}},
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
        operationSeedResponse: seed.operationSeedResponse,
        operationMatchArguments: seed.operationMatchArguments,
        options: {
          usesLeft: -1,
          partialArgs: false,
        },
      });
    });
  });

  describe('mergeOperationResponse', function () {
    it('should not merge anything if seed is not found', function () {
      const sequenceId = 'sequenceId';
      const operationMock = {
        data: {
          product: 'Hello World',
        },
      };

      expect(
        seedManager.mergeOperationResponse({
          operationName: 'operationA',
          variables: {},
          operationMock,
          sequenceId,
        })
      ).toEqual(operationMock);
    });

    it('should merge operation response with operation type seeds', function () {
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
        operationSeedResponse: {data: {product: 'my product'}},
        operationMatchArguments: {sku: 'abc'},
      };
      const expectedOperationResult = {
        data: {
          product: seed.operationSeedResponse.data.product,
          dimensions: operationMock.data.dimensions,
        },
      };

      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed);
      const mergeResult = seedManager.mergeOperationResponse({
        operationName: seed.operationName,
        variables: seed.operationMatchArguments,
        operationMock,
        sequenceId,
      });
      expect(mergeResult).toEqual(expectedOperationResult);
    });

    it('should prioritize seed errors over mock errors', function () {
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
        operationSeedResponse: {
          errors: [{message: 'error registered by the user'}],
        },
        operationMatchArguments: {sku: 'abc'},
      };
      const expectedOperationResult = {
        data: {},
        errors: seed.operationSeedResponse.errors,
      };

      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, seed);
      const mergeResult = seedManager.mergeOperationResponse({
        operationName: seed.operationName,
        variables: seed.operationMatchArguments,
        operationMock,
        sequenceId,
      });
      expect(mergeResult).toEqual(expectedOperationResult);
    });

    it('should merge operation response with network-error type seeds', function () {
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
        operationSeedResponse: {message: 'this will throw an error'},
        operationMatchArguments: {sku: 'unknown sku'},
      };
      const type = SeedType.NetworkError;

      seedManager.registerSeed(sequenceId, type, seed);
      const mergeResult = seedManager.mergeOperationResponse({
        operationName: seed.operationName,
        variables: seed.operationMatchArguments,
        operationMock,
        sequenceId,
      });
      expect(mergeResult).toEqual({data: seed.operationSeedResponse});
    });

    it('should discard seeds after being used the number of times provided at registration', function () {
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
        operationSeedResponse: {data: {product: 'my product'}},
        operationMatchArguments,
      };
      const secondSeed = {
        operationName,
        operationSeedResponse: {data: {product: 'second product'}},
        operationMatchArguments,
      };
      const firstSeedExpectedOperationResult = {
        data: {
          product: firstSeed.operationSeedResponse.data.product,
          dimensions: operationMock.data.dimensions,
        },
      };

      const secondSeedExpectedOperationResult = {
        data: {
          product: secondSeed.operationSeedResponse.data.product,
          dimensions: operationMock.data.dimensions,
        },
      };

      const type = SeedType.Operation;

      seedManager.registerSeed(sequenceId, type, firstSeed, {usesLeft: 2});
      seedManager.registerSeed(sequenceId, type, secondSeed);

      const firstMergeResult = seedManager.mergeOperationResponse({
        operationName,
        variables: operationMatchArguments,
        operationMock,
        sequenceId,
      });
      expect(firstMergeResult).toEqual(firstSeedExpectedOperationResult);
      const secondMergeResult = seedManager.mergeOperationResponse({
        operationName,
        variables: operationMatchArguments,
        operationMock,
        sequenceId,
      });
      expect(secondMergeResult).toEqual(firstSeedExpectedOperationResult);
      // first seed should be discarded now
      const thirdMergeResult = seedManager.mergeOperationResponse({
        operationName,
        variables: operationMatchArguments,
        operationMock,
        sequenceId,
      });
      expect(thirdMergeResult).toEqual(secondSeedExpectedOperationResult);
      const fourthMergeResult = seedManager.mergeOperationResponse({
        operationName,
        variables: operationMatchArguments,
        operationMock,
        sequenceId,
      });
      expect(fourthMergeResult).toEqual(secondSeedExpectedOperationResult);
    });
  });
});
