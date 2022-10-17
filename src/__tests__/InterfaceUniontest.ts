import fetch from 'node-fetch';

import GraphqlMockingService from '../GraphqlMockingService';

const schema = `
    interface Product {
        name: String
    }
    
    type ConcreteProduct implements Product {
        name: String
        type: String
    }
    
    interface Item {
        id: String
    }
    
    type ItemOne implements Item {
        id: String
        someField1: String
    }
    
    type ItemTwo implements Item {
        id: String
        someField2: String
    }
    
    type ItemThree implements Item {
        id: String
        someField3: String
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
        product: Product
        item: Item
    }
`;

describe('interface & unions test', () => {
  let mockingService;
  const port = 3001;
  beforeAll(async () => {
    mockingService = new GraphqlMockingService({port});
    await mockingService.start();
    await mockingService.registerSchema(schema);
  });

  afterAll(async () => {
    await mockingService.stop();
  });

  it('this always passes', async () => {
    const mockingContext = mockingService.createContext();
    const operationName = 'productQuery';
    await mockingContext.operation(operationName, {
      data: {
        product: {
          __typename: 'ConcreteProduct',
          name: 'string',
          type: 'string',
        },
      },
    });

    const operationResult = await fetch(`http://localhost:${port}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        operationName,
        query:
          'query productQuery { product { __typename name ... on ConcreteProduct { type } } }',
      }),
      headers: {
        'Content-Type': 'application/json',
        'mocking-sequence-id': mockingContext.sequenceId,
      },
    }).then((res) => res.json());

    expect(operationResult).toEqual({
      data: {
        product: {
          __typename: 'ConcreteProduct',
          name: 'string',
          type: 'string',
        },
      },
    });
  });

  it('this fails ~75% of the time', async () => {
    const mockingContext = mockingService.createContext();
    const operationName = 'itemQuery';
    await mockingContext.operation(operationName, {
      data: {
        item: {
          __typename: 'ItemOne',
          id: 'string',
          someField1: 'string',
        },
      },
    });

    const operationResult = await fetch(`http://localhost:${port}/graphql`, {
      method: 'post',
      body: JSON.stringify({
        operationName,
        query:
          'query itemQuery { item { __typename id ... on ItemOne { someField1 } ... on ItemTwo { someField2 } ... on ItemThree { someField3 } ... on ItemFour { someField4 } ... on ItemFive { someField5 }} }',
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
        },
      },
    });
  });
});
