import buildPrivateTypeQuery from '../buildPrivateTypeQuery';
import ApolloServerManager from '../../ApolloServerManager';
import fs from 'fs';

const schema = fs.readFileSync(
  `${__dirname}/../../__fixtures__/schema.graphql`,
  'utf-8'
);

describe('buildPrivateTypeQuery', function () {
  let apolloServerManager: ApolloServerManager;

  beforeAll(() => {
    apolloServerManager = new ApolloServerManager();
    apolloServerManager.createApolloServer(schema, {
      subgraph: false,
      fakerConfig: {},
    });
  });

  it('should build a query for the correct interface inline fragment', () => {
    const rollingKey = 'data.item';
    const query = `query itemQuery {
        item {
            __typename
            id
            ... on ItemOne {
                someField1
                subItem1 {
                    __typename
                    id
                    ... on SubItemOne {
                        field1
                    }
                    ... on SubItemTwo {
                        field2
                    }
                    ... on SubItemThree {
                        field3
                    }
                }
                products {
                  name
                }
            }
            ... on ItemTwo {
                someField2
            }
            ... on ItemThree {
                someField3
            }
            ... on ItemFour {
                someField4
            }
            ... on ItemFive {
                someField5
            }
        }
    }`;

    const expectedQuery = `query gqmock_privateQuery {
  gqmock_ItemOne {
    __typename
    id
    someField1
    subItem1 {
      __typename
      id
      ... on SubItemOne {
        field1
        __typename
      }
      ... on SubItemTwo {
        field2
        __typename
      }
      ... on SubItemThree {
        field3
        __typename
      }
    }
    products {
      name
      __typename
    }
  }
  __typename
}`;

    expect(
      buildPrivateTypeQuery({
        query,
        typeName: 'ItemOne',
        operationName: 'itemQuery',
        rollingKey,
        apolloServerManager,
      })
    ).toBe(expectedQuery);
  });

  it('should build a query for the correct union inline fragment', () => {
    const rollingKey = 'data.random';
    const query = `query randomQuery {
        random {
            __typename
            id
            ... on ItemOne {
                someField1
                subItem1 {
                    __typename
                    id
                    ... on SubItemOne {
                        field1
                    }
                    ... on SubItemTwo {
                        field2
                    }
                    ... on SubItemThree {
                        field3
                    }
                }
                products {
                  name
                }
            }
            ... on ItemTwo {
                someField2
            }
            ... on ItemThree {
                someField3
            }
        }
    }`;

    const expectedQuery = `query gqmock_privateQuery {
  gqmock_ItemOne {
    __typename
    id
    someField1
    subItem1 {
      __typename
      id
      ... on SubItemOne {
        field1
        __typename
      }
      ... on SubItemTwo {
        field2
        __typename
      }
      ... on SubItemThree {
        field3
        __typename
      }
    }
    products {
      name
      __typename
    }
  }
  __typename
}`;

    expect(
      buildPrivateTypeQuery({
        query,
        typeName: 'ItemOne',
        operationName: 'randomQuery',
        rollingKey,
        apolloServerManager,
      })
    ).toBe(expectedQuery);
  });

  it('should build a query for the correct nested inline fragment', () => {
    const rollingKey = 'data.item.subItem1';
    const query = `query itemQuery($first: Int!, $second: String!) {
        item(first: $first) {
            __typename
            id
            ... on ItemOne {
                someField1
                subItem1 {
                    __typename
                    id
                    fieldWithVariable(first: $first)
                    ... on SubItemOne {
                        field1
                        anotherWithSameVariable(first: $first)
                        anotherWithDifferentVariable(second: $second)
                    }
                    ... on SubItemTwo {
                        field2
                    }
                    ... on SubItemThree {
                        field3
                    }
                }
            }
            ... on ItemTwo {
                someField2
            }
            ... on ItemThree {
                someField3
            }
            ... on ItemFour {
                someField4
            }
            ... on ItemFive {
                someField5
            }
        }
    }`;

    const expectedQuery = `query gqmock_privateQuery($first: Int!, $second: String!) {
  gqmock_SubItemOne {
    __typename
    id
    fieldWithVariable(first: $first)
    field1
    anotherWithSameVariable(first: $first)
    anotherWithDifferentVariable(second: $second)
  }
  __typename
}`;

    expect(
      buildPrivateTypeQuery({
        query,
        typeName: 'SubItemOne',
        operationName: 'itemQuery',
        rollingKey,
        apolloServerManager,
      })
    ).toBe(expectedQuery);
  });

  it('should build a query for type without interfaces', () => {
    const rollingKey = 'data.productByName.variants';
    const query = `
      query productByName($name: String!) {
        productByName(name: $name) {
          name
          dimensions {
            length
            width
            height
          }
          variants {
            name
          }
        }
      }
    `;

    expect(
      buildPrivateTypeQuery({
        query,
        typeName: 'ProductVariant',
        operationName: 'productByName',
        rollingKey,
        apolloServerManager,
      })
    ).toBe(`query gqmock_privateQuery {
  gqmock_ProductVariant {
    name
    __typename
  }
  __typename
}`);
  });

  it('should build a query with aliases and fragments', () => {
    const rollingKey = 'data.officeItems.aliasedSubItem';
    const query = `fragment commonItemsFields on Item {
        __typename
        nodeId: id
        type
        ... on ItemOne {
          someField1
          aliasedSubItem: subItem1 {
            __typename
            id
            ... on SubItemOne {
              field1
              product {
                type
                name
              }
            }
            ... on SubItemTwo {
              field2
            }
            ... on SubItemThree {
              field3
            }
          }
        }
        ... on ItemTwo {
          someField2
        }
        ... on ItemThree {
          someField3
        }
        ... on ItemFour {
          someField4
        }
        ... on ItemFive {
          someField5
        }
      }

    query itemsQuery {
      officeItems: items(type: "office") {
        ...commonItemsFields
      }
      homeItems: items(type: "home") {
        ...commonItemsFields
      }
    }`;

    const expectedQuery = `query gqmock_privateQuery {
  gqmock_SubItemOne {
    __typename
    id
    field1
    product {
      type
      name
      __typename
    }
  }
  __typename
}`;

    expect(
      buildPrivateTypeQuery({
        query: apolloServerManager.expandFragments(query),
        typeName: 'SubItemOne',
        operationName: 'itemsQuery',
        rollingKey,
        apolloServerManager,
      })
    ).toBe(expectedQuery);
  });

  it('should select the deeply nested union of all fields in each selection set', () => {
    const query = `
      fragment randomFragment_itemConnection on ItemConnection {
        totalCount
        edges {
          node {
            id
            type
          }
        }
      }

      fragment itemConnection_query on Query {
        itemConnection {
          edges {
            cursor
            node {
              id
              ... on ItemOne {
                id
                someField1: String
              }
            }
          }
          ...randomFragment_itemConnection
        }
      }

      query itemsQuery {
        ...itemConnection_query
      }`;

    const expectedItemConnectionQuery = `query gqmock_privateQuery {
  gqmock_ItemConnection {
    edges {
      cursor
      node {
        id
        ... on ItemOne {
          id
          someField1: String
          __typename
        }
        __typename
      }
      __typename
    }
    totalCount
    edges {
      node {
        id
        type
        __typename
      }
      __typename
    }
    __typename
  }
  __typename
}`;

    expect(
      buildPrivateTypeQuery({
        query: apolloServerManager.expandFragments(query),
        typeName: 'ItemConnection',
        operationName: 'itemsQuery',
        rollingKey: 'data.itemConnection',
        apolloServerManager,
      })
    ).toBe(expectedItemConnectionQuery);

    const expectEdgesQuery = `query gqmock_privateQuery {
  gqmock_ItemEdge {
    cursor
    node {
      id
      ... on ItemOne {
        id
        someField1: String
        __typename
      }
      __typename
    }
    node {
      id
      type
      __typename
    }
    __typename
  }
  __typename
}`;
    expect(
      buildPrivateTypeQuery({
        query: apolloServerManager.expandFragments(query),
        typeName: 'ItemEdge',
        operationName: 'itemsQuery',
        rollingKey: 'data.itemConnection.edges',
        apolloServerManager,
      })
    ).toBe(expectEdgesQuery);
  });
});
