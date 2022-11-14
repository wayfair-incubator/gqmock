import buildUnionTypeQuery from '../buildUnionTypeQuery';
import ApolloServerManager from '../../ApolloServerManager';

describe('buildUnionTypeQuery', function () {
  let apolloServerManager;
  const schema = `
    type Tag1 {
        value: String
    }
    
    type Picture {
        url: String
    }
    
    type ProductVariant {
        name: String
        color: String
        tags: [Tag1]
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
      }
      ... on SubItemTwo {
        field2
      }
      ... on SubItemThree {
        field3
      }
    }
  }
}`;

    expect(
      buildUnionTypeQuery({
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
}`;

    expect(
      buildUnionTypeQuery({
        query,
        typeName: 'SubItemOne',
        operationName: 'itemQuery',
        rollingKey,
        apolloServerManager,
      })
    ).toBe(expectedQuery);
  });
});
