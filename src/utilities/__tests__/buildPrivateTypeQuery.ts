import buildPrivateTypeQuery from '../buildPrivateTypeQuery';
import ApolloServerManager from '../../ApolloServerManager';
import fs from 'fs';

const schema = fs.readFileSync(
  `${__dirname}/../../__fixtures__/schema.graphql`,
  'utf-8'
);

describe('buildPrivateTypeQuery', function () {
  let apolloServerManager;
  beforeAll(() => {
    apolloServerManager = new ApolloServerManager();
    apolloServerManager.createApolloServer(schema, {});
  });
  it('should build a query for the correct inline fragment', function () {
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

  it('should build a query for the correct nested inline fragment', function () {
    const rollingKey = 'data.item.subItem1';
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
  gqmock_SubItemOne {
    __typename
    id
    field1
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

  it('should build a query for type without interfaces', function () {
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
});
