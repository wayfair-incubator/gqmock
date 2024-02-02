import fs from 'fs';
import fetch from 'node-fetch';
import {GraphQLIDE} from '../GraphQLIDE';
import GraphqlMockingService from '../GraphqlMockingService';

const schema = fs.readFileSync(
  `${__dirname}/../__fixtures__/schema.graphql`,
  'utf-8'
);

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

  describe('without fakerConfig', function () {
    beforeEach(async () => {
      await mockingService.registerSchema(schema);
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
          __typename: 'Query',
          productByName: expect.objectContaining({
            __typename: 'Product',
            name: 'Flagship Desk',
            variants: [
              {
                __typename: 'ProductVariant',
                name: 'office desk',
              },
              {
                __typename: 'ProductVariant',
                name: 'office desk',
              },
              {
                __typename: 'ProductVariant',
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

      expect(operationResult).toEqual(networkErrorMessage);
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
          __typename: 'Query',
          productBySku: expect.objectContaining({
            __typename: 'Product',
            name: 'Hello World',
            variants: [
              {
                __typename: 'ProductVariant',
                name: 'Hello World',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                ],
              },
              {
                __typename: 'ProductVariant',
                name: 'Hello World',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
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
            __typename: 'Query',
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
          __typename: 'Query',
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
          __typename: 'Query',
          productBySku: {
            __typename: 'Product',
            name: 'Flagship Desk',
            variants: [
              {
                __typename: 'ProductVariant',
                name: 'office',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                ],
              },
              {
                __typename: 'ProductVariant',
                name: 'office',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                ],
              },
              {
                __typename: 'ProductVariant',
                name: 'office',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
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
          __typename: 'Query',
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
          __typename: 'Query',
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
          __typename: 'Query',
          productBySku: {
            __typename: 'Product',
            name: 'Flagship Desk',
            variants: [
              {
                __typename: 'ProductVariant',
                name: 'office',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                ],
              },
              {
                __typename: 'ProductVariant',
                name: 'office',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                ],
              },
              {
                __typename: 'ProductVariant',
                name: 'office',
                tags: [
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                  {
                    __typename: 'Tag',
                    value: 'Hello World',
                  },
                ],
              },
            ],
          },
        },
      });

      expect(secondOperationResult).toEqual(secondMock);
      expect(thirdOperationResult).toEqual(thirdMock);
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
          __typename: 'Query',
          getRandomEmployee: {
            __typename: 'Employee',
            name: 'John',
          },
        },
      });

      await subgraphMockingService.stop();
    });

    it('should allow creating contexts with a shared sequenceId', () => {
      const contextA = mockingService.createContext();
      const contextB = subgraphMockingService.createContext(
        contextA.sequenceId
      );

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
          __typename: 'Query',
          item: {
            __typename: 'ItemOne',
            id: 'string',
            someField1: 'string',
            subItem1: {
              __typename: 'SubItemOne',
              id: 'string',
              field1: 'string',
              product: {
                __typename: 'ConcreteProduct',
                type: 'productType',
                name: 'productName',
              },
            },
          },
        },
      });
    });

    it('should handle aliases and nested fragments correctly', async () => {
      const mockingContext = mockingService.createContext();
      const operationName = 'itemsQuery';
      await mockingContext.operation(operationName, {
        data: {
          homeItems: [
            {},
            {},
            {},
            {
              __typename: 'ItemFive',
              nodeId: 'aliased id field',
              type: 'home',
            },
          ],
          officeItems: [
            {},
            {},
            {
              __typename: 'ItemOne',
              nodeId: 'string',
              type: 'office',
              someField1: 'string',
              aliasedSubItem: {
                __typename: 'SubItemOne',
                id: 'string',
                field1: 'string',
                product: {
                  type: 'productType',
                  name: 'productName',
                },
              },
            },
          ],
        },
      });

      const operationResult = await fetch(`http://localhost:${port}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query: `fragment commonItemsFields on Item { __typename nodeId: id type ... on ItemOne { someField1 aliasedSubItem: subItem1 { __typename id ... on SubItemOne { field1 product { type name } } ... on SubItemTwo { field2 } ... on SubItemThree { field3 } } } ... on ItemTwo { someField2 } ... on ItemThree { someField3 } ... on ItemFour { someField4 } ... on ItemFive { someField5 }}

fragment commonItems2 on Item { ...commonItemsFields }

fragment commonItems3 on Item { ...commonItems2 }

query itemsQuery { officeItems: items(type: "office") { ...commonItems3 } homeItems: items(type: "home") { ...commonItems2 }}
`,
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }).then((res) => res.json());

      expect(operationResult.data.homeItems).toContainEqual({
        __typename: 'ItemFive',
        nodeId: 'aliased id field',
        someField5: 'Hello World',
        type: 'home',
      });
      expect(operationResult.data.officeItems).toContainEqual({
        __typename: 'ItemOne',
        aliasedSubItem: {
          __typename: 'SubItemOne',
          field1: 'string',
          id: 'string',
          product: {
            __typename: 'ConcreteProduct',
            name: 'productName',
            type: 'productType',
          },
        },
        nodeId: 'string',
        someField1: 'string',
        type: 'office',
      });
    });

    it('should mock nested interfaces and arrays correctly', async () => {
      const mockingContext = mockingService.createContext();
      const operationName = 'itemQuery';
      const seed = {
        data: {
          __typename: 'Query',
          item: {
            __typename: 'ItemOne',
            id: 'string',
            someField1: 'string',
            subItems: [
              {
                __typename: 'SubItemOne',
                id: 'string',
                field1: 'string',
                product: {
                  __typename: 'ConcreteProduct',
                  type: 'productType',
                  name: 'productName',
                },
              },
              {
                __typename: 'SubItemTwo',
                id: 'subTwoId',
                field2: 'field2',
              },
              {
                __typename: 'SubItemThree',
                id: 'subThreeId',
                field3: 'field3',
              },
            ],
          },
        },
      };

      await mockingContext.operation(operationName, seed);

      const operationResult = await fetch(`http://localhost:${port}/graphql`, {
        method: 'post',
        body: JSON.stringify({
          operationName,
          query:
            'query itemQuery { item { __typename id ... on ItemOne { someField1 subItems { __typename id ... on SubItemOne { field1 product { type name } } ... on SubItemTwo { field2 } ... on SubItemThree { field3 }}} ... on ItemTwo { someField2 } ... on ItemThree { someField3 } ... on ItemFour { someField4 } ... on ItemFive { someField5 }}}',
        }),
        headers: {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        },
      }).then((res) => res.json());

      expect(operationResult).toEqual(seed);
    });

    it('should return different mock values between queries', async () => {
      const mockingContext = mockingService.createContext();
      const operationName = 'productByName';
      const variables = {name: 'desk'};
      const query = `query productByName($name: String!) { productByName(name: $name) { id } }`;
      const headers = {
        'Content-Type': 'application/json',
        'mocking-sequence-id': mockingContext.sequenceId,
      };

      const firstOperationResult = await fetch(
        `http://localhost:${port}/graphql`,
        {
          method: 'post',
          body: JSON.stringify({
            operationName,
            query,
            variables,
          }),
          headers,
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
          headers,
        }
      ).then((res) => res.json());

      expect(firstOperationResult.data.productByName.id).not.toBe(
        secondOperationResult.data.productByName.id
      );
    });

    it('should allow changing http statusCode for operation seeds', async () => {
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
        {name: 'desk'},
        {statusCode: 201}
      );

      const operationResponse = await fetch(
        `http://localhost:${port}/graphql`,
        {
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
        }
      );

      expect(operationResponse.status).toEqual(201);
      expect(await operationResponse.json()).toEqual({
        data: {
          __typename: 'Query',
          productByName: expect.objectContaining({
            __typename: 'Product',
            name: 'Flagship Desk',
            variants: [
              {
                __typename: 'ProductVariant',
                name: 'office desk',
              },
              {
                __typename: 'ProductVariant',
                name: 'office desk',
              },
              {
                __typename: 'ProductVariant',
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

    it('should allow changing http statusCode for network error seeds', async () => {
      const operationName = 'productBySku';
      const networkErrorMessage = {message: 'this will cause a network error'};
      const mockingContext = mockingService.createContext();
      await mockingContext.networkError(
        operationName,
        networkErrorMessage,
        {
          sku: 'network error',
        },
        {statusCode: 401}
      );

      const requestResponse = await fetch(`http://localhost:${port}/graphql`, {
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
      });

      expect(requestResponse.status).toEqual(401);
      expect(await requestResponse.json()).toEqual(networkErrorMessage);
    });

    it('should support plain text network errors', async () => {
      const operationName = 'productBySku';
      const networkErrorMessage = 'this will cause a network error';
      const mockingContext = mockingService.createContext();
      await mockingContext.networkError(
        operationName,
        networkErrorMessage,
        {
          sku: 'network error',
        },
        {statusCode: 401}
      );

      const requestResponse = await fetch(`http://localhost:${port}/graphql`, {
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
      });

      expect(requestResponse.status).toEqual(401);
      expect(await requestResponse.text()).toEqual(networkErrorMessage);
    });

    it('should support null network errors', async () => {
      const operationName = 'productBySku';
      const networkErrorMessage = null;
      const mockingContext = mockingService.createContext();
      await mockingContext.networkError(
        operationName,
        networkErrorMessage,
        {
          sku: 'network error',
        },
        {statusCode: 401}
      );

      const requestResponse = await fetch(`http://localhost:${port}/graphql`, {
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
      });

      expect(requestResponse.status).toEqual(401);
      expect(await requestResponse.text()).toEqual('');
    });
  });

  describe('with fakerConfig', function () {
    const fakerConfig = {
      Product: {
        id: {
          method: 'datatype.string',
        },
        name: {
          method: 'commerce.product',
        },
      },
      Dimensions: {
        length: {
          method: 'random.numeric',
          args: 2,
        },
        width: {
          method: 'random.numeric',
          args: [2],
        },
        height: {
          method: 'random.numeric',
          args: 3,
        },
      },
      ProductVariant: {
        name: {
          method: 'random.words',
          args: 3,
        },
      },
    };

    describe('with scalars', () => {
      beforeEach(async () => {
        const fakerWithScalars = {
          ...fakerConfig,
          DateTime: {
            method: 'datatype.datetime',
          },
        };
        await mockingService.registerSchema(schema, {
          fakerConfig: fakerWithScalars,
        });
      });

      it('should use the faker config to generate realistic data for unseeded fields', async () => {
        const mockingContext = mockingService.createContext();
        const operationName = 'productByName';
        await mockingContext.operation(
          operationName,
          {
            data: {
              productByName: {
                name: 'Flagship Desk',
              },
            },
          },
          {name: 'desk'}
        );

        const operationResult = await fetch(
          `http://localhost:${port}/graphql`,
          {
            method: 'post',
            body: JSON.stringify({
              operationName,
              query:
                'query productByName($name: String!) { productByName(name: $name) { name listedAt dimensions { length, width, height }, variants { name } } }',
              variables: {name: 'desk'},
            }),
            headers: {
              'Content-Type': 'application/json',
              'mocking-sequence-id': mockingContext.sequenceId,
            },
          }
        ).then((res) => res.json());

        // Check seeded properties
        expect(operationResult).toEqual({
          data: {
            __typename: 'Query',
            [operationName]: expect.objectContaining({
              name: 'Flagship Desk',
            }),
          },
        });

        // Check scalar properties generated by faker
        expect(operationResult.data[operationName].listedAt).toMatch(
          /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/
        );

        // Check random properties generated by faker
        expect(
          operationResult.data[operationName].dimensions.height.toString()
            .length
        ).toEqual(3);
        expect(
          operationResult.data[operationName].dimensions.length.toString()
            .length
        ).toEqual(2);
        expect(
          operationResult.data[operationName].dimensions.width.toString().length
        ).toEqual(2);
        expect(operationResult.data[operationName].variants).not.toContainEqual(
          expect.objectContaining({
            name: 'Hello World',
          })
        );
      });
    });

    describe('with no scalars', () => {
      beforeEach(async () => {
        await mockingService.registerSchema(schema, {fakerConfig});
      });

      it('should use the faker config to generate realistic data for unseeded fields', async () => {
        const mockingContext = mockingService.createContext();
        const operationName = 'productByName';
        await mockingContext.operation(
          operationName,
          {
            data: {
              productByName: {
                name: 'Flagship Desk',
              },
            },
          },
          {name: 'desk'}
        );

        const operationResult = await fetch(
          `http://localhost:${port}/graphql`,
          {
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
          }
        ).then((res) => res.json());

        // Check seeded properties
        expect(operationResult).toEqual({
          data: {
            __typename: 'Query',
            [operationName]: expect.objectContaining({
              name: 'Flagship Desk',
            }),
          },
        });

        // Check random properties generated by faker
        expect(
          operationResult.data[operationName].dimensions.height.toString()
            .length
        ).toEqual(3);
        expect(
          operationResult.data[operationName].dimensions.length.toString()
            .length
        ).toEqual(2);
        expect(
          operationResult.data[operationName].dimensions.width.toString().length
        ).toEqual(2);
        expect(operationResult.data[operationName].variants).not.toContainEqual(
          expect.objectContaining({
            name: 'Hello World',
          })
        );
      });

      it('should return different faker values between queries', async () => {
        const mockingContext = mockingService.createContext();
        const operationName = 'productByName';
        const variables = {name: 'desk'};
        const query = `query productByName($name: String!) { productByName(name: $name) { id } }`;
        const headers = {
          'Content-Type': 'application/json',
          'mocking-sequence-id': mockingContext.sequenceId,
        };

        const firstOperationResult = await fetch(
          `http://localhost:${port}/graphql`,
          {
            method: 'post',
            body: JSON.stringify({
              operationName,
              query,
              variables,
            }),
            headers,
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
            headers,
          }
        ).then((res) => res.json());

        expect(firstOperationResult.data.productByName.id).not.toBe(
          secondOperationResult.data.productByName.id
        );
      });

      it('returns the Apollo Sandbox GraphQL IDE by default', async () => {
        await fetch(`http://localhost:${port}/graphql`, {
          method: 'get',
        })
          .then((res) => {
            return res.text();
          })
          .then((text) => {
            expect(text).toContain('.apollographql.com');
          })
          .catch(() => {
            throw new Error('Expected a 200 response');
          });
      });

      it('returns the GraphiQL GraphQL IDE when configured', async () => {
        // This is pretty gross. I plan on comming back to refactor this test suite.
        await mockingService.stop();
        mockingService = new GraphqlMockingService({
          port,
          graphQLIDE: GraphQLIDE.GraphiQL,
        });
        await mockingService.start();
        await fetch(`http://localhost:${port}/graphql`, {
          method: 'get',
        })
          .then((res) => {
            return res.text();
          })
          .then((text) => {
            expect(text).toContain('GraphiQL');
          })
          .catch(() => {
            throw new Error('Expected a 200 response');
          });
      });

      it('should return a 404 when no GraphQL IDE UI is configured', async () => {
        // This is pretty gross. I plan on comming back to refactor this test suite.
        await mockingService.stop();
        mockingService = new GraphqlMockingService({
          port,
          graphQLIDE: GraphQLIDE.None,
        });
        await mockingService.start();
        await fetch(`http://localhost:${port}/graphql`, {
          method: 'get',
        })
          .then((res) => {
            expect(res.status).toEqual(404);
          })
          .catch(() => {
            throw new Error('Expected a 404 response');
          });
      });
    });
  });
});
