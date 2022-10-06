import fetch from 'node-fetch';

import GraphqlMockingService from '../GraphqlMockingService';

const schema = `
    type Tag {
        value: String
    }
    
    type Picture {
        url: String
    }
    
    type ProductVariant {
        name: String
        color: String
        tags: [Tag]
        pictures: [Picture]
    }
    
    type Dimensions {
        length: Int
        width: Int
        height: Int
    }
    
    type Product {
        name: String
        variants: [ProductVariant]
        dimensions: Dimensions
    }
    
    type Query {
        products: [Product]
        productByName(name: String!): Product
        productBySku(sku: String!): Product
    }
`;

describe('GraphqlMockingService', () => {
  const port = 3001;
  let mockingService;
  const sequenceId = 'test-sequence-id';
  beforeAll(async () => {
    mockingService = new GraphqlMockingService({port});
    await mockingService.start();
    await mockingService.registerSchema(schema);
  });

  afterAll(async () => {
    await mockingService.stop();
  });

  it('should allow operation seed registration', async () => {
    const mockingContext = mockingService.createContext();
    const operationName = 'productByName';
    await mockingContext.operation(
      operationName,
      {
        data: {
          productByName: {
            name: 'Flagship Desk',
            variants: {
              name: 'office desk',
              tags: {value: 'adjustable', $length: 3},
              $length: 3,
            },
          },
        },
      },
      {name: 'desk'}
    );

    const operationResult = await fetch(`http://localhost:${port}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        operationName,
        query:
          'query productByName($name: String!) { productByName(name: $name) { name, dimensions { length, width, height }, variants { name } } }',
        variables: {name: 'desk'},
      }),
      headers: {
        'Content-Type': 'application/json',
        'mocking-sequence-id': mockingContext.sequenceId,
      },
    }).then((res) => res.json());

    expect(operationResult).toEqual({
      data: {
        productByName: expect.objectContaining({
          name: 'Flagship Desk',
          variants: [
            {
              name: 'office desk',
            },
            {
              name: 'office desk',
            },
            {
              name: 'office desk',
            },
          ],
        }),
      },
      warnings: [
        'Skipping "data.productByName.variants.tags": key not found in source.',
      ],
    });
  });

  it('should allow network error registration', async () => {
    const operationName = 'productBySku';
    const networkErrorMessage = {message: 'this will cause a network error'};
    const mockingContext = mockingService.createContext();
    await mockingContext.networkError(operationName, networkErrorMessage, {
      sku: 'network error',
    });

    const operationResult = await fetch(`http://localhost:${port}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        operationName,
        query:
          'query productBySku($sku: String!) { productBySku(sku: $sku) { name, dimensions { length, width, height }, variants { name, tags { value } } } }',
        variables: {sku: 'network error'},
      }),
      headers: {
        'Content-Type': 'application/json',
        'mocking-sequence-id': mockingContext.sequenceId,
      },
    }).then((res) => res.json());

    expect(operationResult).toEqual({data: networkErrorMessage});
  });

  it('should return unmerged mock if no seeds are found', async () => {
    const operationName = 'productBySku';
    const operationResult = await fetch(`http://localhost:${port}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        operationName,
        query:
          'query productBySku($sku: String!) { productBySku(sku: $sku) { name, dimensions { length, width, height }, variants { name, tags { value } } } }',
        variables: {sku: 'random sku'},
      }),
      headers: {
        'Content-Type': 'application/json',
        'mocking-sequence-id': sequenceId,
      },
    }).then((res) => res.json());

    expect(operationResult).toEqual({
      data: {
        productBySku: expect.objectContaining({
          name: 'Hello World',
          variants: [
            {
              name: 'Hello World',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
            {
              name: 'Hello World',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
          ],
        }),
      },
    });
  });

  it('should return correct errors from the seed and hide data from mock', async () => {
    const operationName = 'productBySku';
    const mockingContext = mockingService.createContext();
    await mockingContext.operation(
      'productBySku',
      {
        data: {
          productBySku: null,
        },
        errors: ['No product found for the given sku'],
      },
      {sku: 'invalid sku'}
    );

    const operationResult = await fetch(`http://localhost:${port}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        operationName,
        query:
          'query productBySku($sku: String!) { productBySku(sku: $sku) { name, dimensions { length, width, height }, variants { name, tags { value } } } }',
        variables: {sku: 'invalid sku'},
      }),
      headers: {
        'Content-Type': 'application/json',
        'mocking-sequence-id': mockingContext.sequenceId,
      },
    }).then((res) => res.json());

    expect(operationResult).toEqual({
      data: {
        productBySku: null,
      },
      errors: ['No product found for the given sku'],
    });
  });

  it('should discard seeds after being used the number of times passed during registration', async () => {
    const operationName = 'productBySku';
    const operationArguments = {sku: 'abc'};
    const firstMock = {
      data: {
        productBySku: {
          name: 'Flagship Desk',
          variants: {
            name: 'office',
            $length: 3,
          },
        },
      },
    };

    const secondMock = {
      data: {
        productBySku: null,
      },
      errors: ['No product found for the given sku'],
    };

    const mockingContext = mockingService.createContext();
    await mockingContext.operation(
      operationName,
      firstMock,
      operationArguments,
      {usesLeft: 2}
    );

    await mockingContext.operation(
      operationName,
      secondMock,
      operationArguments
    );

    const query =
      'query productBySku($sku: String!) { productBySku(sku: $sku) { name, variants { name, tags { value } } } }';
    const variables = operationArguments;

    const firstOperationResult = await fetch(
      `http://localhost:${port}/graphql`,
      {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query,
          variables,
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }
    ).then((res) => res.json());
    const secondOperationResult = await fetch(
      `http://localhost:${port}/graphql`,
      {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query,
          variables,
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }
    ).then((res) => res.json());
    const thirdOperationResult = await fetch(
      `http://localhost:${port}/graphql`,
      {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query,
          variables,
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }
    ).then((res) => res.json());

    expect(firstOperationResult).toEqual({
      data: {
        productBySku: {
          name: 'Flagship Desk',
          variants: [
            {
              name: 'office',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
            {
              name: 'office',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
            {
              name: 'office',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
          ],
        },
      },
    });

    expect(firstOperationResult).toEqual(secondOperationResult);
    expect(thirdOperationResult).toEqual({
      data: {
        productBySku: null,
      },
      errors: ['No product found for the given sku'],
    });
  });

  it('should allow chaining multiple registrations together', async () => {
    const operationName = 'productBySku';
    const firstOperationArguments = {sku: 'abc'};
    const secondOperationArguments = {sku: 'def'};
    const thirdOperationArguments = {sku: 'network error'};
    const firstMock = {
      data: {
        productBySku: {
          name: 'Flagship Desk',
          variants: {
            name: 'office',
            $length: 3,
          },
        },
      },
    };

    const secondMock = {
      data: {
        productBySku: null,
      },
      errors: ['No product found for the given sku'],
    };

    const thirdMock = {message: 'this will cause a network error'};

    const mockingContext = mockingService.createContext();
    await mockingContext
      .operation(operationName, firstMock, firstOperationArguments, {
        usesLeft: 2,
      })
      .operation(operationName, secondMock, secondOperationArguments)
      .networkError(operationName, thirdMock, thirdOperationArguments);

    const query =
      'query productBySku($sku: String!) { productBySku(sku: $sku) { name, variants { name, tags { value } } } }';

    const firstOperationResult = await fetch(
      `http://localhost:${port}/graphql`,
      {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query,
          variables: firstOperationArguments,
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }
    ).then((res) => res.json());
    const secondOperationResult = await fetch(
      `http://localhost:${port}/graphql`,
      {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query,
          variables: secondOperationArguments,
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }
    ).then((res) => res.json());
    const thirdOperationResult = await fetch(
      `http://localhost:${port}/graphql`,
      {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query,
          variables: thirdOperationArguments,
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }
    ).then((res) => res.json());

    expect(firstOperationResult).toEqual({
      data: {
        productBySku: {
          name: 'Flagship Desk',
          variants: [
            {
              name: 'office',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
            {
              name: 'office',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
            {
              name: 'office',
              tags: [
                {
                  value: 'Hello World',
                },
                {
                  value: 'Hello World',
                },
              ],
            },
          ],
        },
      },
    });

    expect(secondOperationResult).toEqual(secondMock);
    expect(thirdOperationResult).toEqual({data: thirdMock});
  });
});
