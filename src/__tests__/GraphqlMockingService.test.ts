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
    
    interface SomeProduct {
        name: String
    }
    
    type ConcreteProduct implements SomeProduct {
        name: String
        type: String
    }
    
    interface SubItem {
        id: String
    }
    
    type SubItemOne implements SubItem {
        id: String
        field1: String
        product: ConcreteProduct
    }
    
    type SubItemTwo implements SubItem {
        id: String
        field2: String
    }
    
    type SubItemThree implements SubItem {
        id: String
        field3: String
    }
    
    interface Item {
        id: String
    }
    
    type ItemOne implements Item {
        id: String
        someField1: String
        subItem1: SubItem
    }
    
    type ItemTwo implements Item {
        id: String
        someField2: String
        subItem2: SubItem
    }
    
    type ItemThree implements Item {
        id: String
        someField3: String
        subItem3: SubItem
    }
    
    type ItemFour implements Item {
        id: String
        someField4: String
    }
    
    type ItemFive implements Item {
        id: String
        someField5: String
    }
    
    type Query {
        products: [Product]
        productByName(name: String!): Product
        productBySku(sku: String!): Product
        item: Item
    }
`;

const subgraphSchema = `
      type Query {
        getRandomEmployee: Employee
      }

      type Employee {
        name: String!
      }

      extend type Employee {
        age: Int!
      }

      extend type Company @key(fields: "companyId") {
        companyId: Int! @external
        employees: [Employee]
      }
    `;

describe('GraphqlMockingService', () => {
  const port = 3001;
  const subgraphPort = 3002;
  let mockingService;
  let subgraphMockingService;
  const sequenceId = 'test-sequence-id';
  const consoleLogOrig = console.log;
  const consoleInfoOrig = console.info;
  beforeAll(async () => {
    console.log = jest.fn();
    console.info = jest.fn();
    mockingService = new GraphqlMockingService({port});
    await mockingService.start();
    await mockingService.registerSchema(schema);

    subgraphMockingService = new GraphqlMockingService({
      port: subgraphPort,
      subgraph: true,
    });
    await subgraphMockingService.start();
    await subgraphMockingService.registerSchema(subgraphSchema);
  });

  afterAll(async () => {
    console.log = consoleLogOrig;
    console.info = consoleInfoOrig;
    await mockingService.stop();
    await subgraphMockingService.stop();
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

  it('should support subgraph schemas', async () => {
    const mockingContext = subgraphMockingService.createContext();
    const operationName = 'getEmployee';
    await mockingContext.operation(
      operationName,
      {
        data: {
          getRandomEmployee: {
            name: 'John',
          },
        },
      },
      {}
    );

    const operationResult = await fetch(
      `http://localhost:${subgraphPort}/graphql`,
      {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query: 'query getEmployee { getRandomEmployee { name } }',
          variables: {},
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }
    ).then((res) => res.json());

    expect(operationResult).toEqual({
      data: {
        getRandomEmployee: {
          name: 'John',
        },
      },
    });

    await subgraphMockingService.stop();
  });

  it('should allow creating contexts with a shared sequenceId', function () {
    const contextA = mockingService.createContext();
    const contextB = subgraphMockingService.createContext(contextA.sequenceId);

    expect(contextA.sequenceId === contextB.sequenceId);
  });

  it('handles explicit mocks of a single type on an interface', async () => {
    const mockingContext = mockingService.createContext();
    const operationName = 'itemQuery';
    await mockingContext.operation(operationName, {
      data: {
        item: {
          __typename: 'ItemOne',
          id: 'string',
          someField1: 'string',
          subItem1: {
            __typename: 'SubItemOne',
            id: 'string',
            field1: 'string',
            product: {
              type: 'productType',
              name: 'productName',
            },
          },
        },
      },
    });

    const operationResult = await fetch(`http://localhost:${port}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        operationName,
        query:
          'query itemQuery { item { __typename id ... on ItemOne { someField1 subItem1 { __typename id ... on SubItemOne { field1 product { type name } } ... on SubItemTwo { field2 } ... on SubItemThree { field3 }}} ... on ItemTwo { someField2 } ... on ItemThree { someField3 } ... on ItemFour { someField4 } ... on ItemFive { someField5 }}}',
      }),
      headers: {
        'Content-Type': 'application/json',
        'mocking-sequence-id': mockingContext.sequenceId,
      },
    }).then((res) => res.json());

    expect(operationResult).toEqual({
      data: {
        item: {
          __typename: 'ItemOne',
          id: 'string',
          someField1: 'string',
          subItem1: {
            __typename: 'SubItemOne',
            id: 'string',
            field1: 'string',
            product: {
              type: 'productType',
              name: 'productName',
            },
          },
        },
      },
    });
  });
});
