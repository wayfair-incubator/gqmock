import deepMerge from '../deepMerge';
import {buildSchema} from 'graphql';
import SeedManager from "../../seed/SeedManager";
import ApolloServerManager from "../../ApolloServerManager";

const schemaSource = `
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
    
    enum SomeEnum {
        ONE
        TWO
    }
`;

const schema = buildSchema(schemaSource);

describe('deepMerge', () => {
  let apolloServerManager;
  beforeAll(() => {
    apolloServerManager = new ApolloServerManager();
    apolloServerManager.createApolloServer(schemaSource, {});
  });

  it('should merge source with a partially defined object', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          manufacturer: {
            name: 'sourceManufacturerName',
            address: {
              streetName: 'sourceAddressStreetName',
            },
          },
        },
      },
    };

    const seed = {
      data: {
        product: {
          manufacturer: {
            name: 'I Build Desks',
          },
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'sourceProductName',
          manufacturer: {
            name: 'I Build Desks',
            address: {
              streetName: 'sourceAddressStreetName',
            },
          },
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should merge source with a fully defined object', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          manufacturer: {
            name: 'sourceManufacturerName',
            address: {
              streetName: 'sourceAddressStreetName',
            },
          },
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          manufacturer: {
            name: 'I Build Desks',
            address: {
              streetName: 'Forest Hills',
            },
          },
        },
      },
    };

    const expectedResult = seed;

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should return merged data with warnings if any fields are skipped', async function () {
    // seed defines fields not present in source
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          manufacturer: {
            name: 'sourceManufacturerName',
            address: {
              streetName: 'sourceAddressStreetName',
            },
          },
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          price: {
            value: 299,
            currency: '$',
          },
          color: 'Brown',
          manufacturer: {
            name: 'I Build Desks',
            address: {
              streetName: 'Forest Hills',
            },
          },
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          manufacturer: {
            name: 'I Build Desks',
            address: {
              streetName: 'Forest Hills',
            },
          },
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(2);
    expect(mergeResult.warnings).toContain(
      'Skipping "data.product.price": key not found in source.'
    );
    expect(mergeResult.warnings).toContain(
      'Skipping "data.product.color": key not found in source.'
    );
  });

  it('should merge data with falsy values in source', async function () {
    const source = {
      data: {
        item: {
          hasThing: false,
        },
      },
    };

    const seed = {
      data: {
        item: {
          hasThing: true,
        },
      },
    };

    const expectedResult = {
      data: {
        item: {
          hasThing: true,
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should merge arrays using longhand notation', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
            },
            {
              name: 'sourceVariantName',
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [{}, {}, {}, {name: 'office desk'}],
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
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
            {
              name: 'office desk',
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should merge arrays using shorthand notation', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
            },
            {
              name: 'sourceVariantName',
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: {name: 'office desk', $length: 4},
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
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
            {
              name: 'office desk',
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should merge nested arrays using longhand notation', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
              tags: [
                {
                  value: 'sourceTagValue',
                },
                {
                  value: 'sourceTagValue',
                },
              ],
            },
            {
              name: 'sourceVariantName',
              tags: [
                {
                  value: 'sourceTagValue',
                },
                {
                  value: 'sourceTagValue',
                },
              ],
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [
            {},
            {},
            {},
            {
              name: 'office desk',
              tags: [{}, {}, {value: 'adjustable'}],
            },
          ],
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should merge nested arrays using shorthand notation', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
              tags: [
                {
                  value: 'sourceTagValue',
                },
                {
                  value: 'sourceTagValue',
                },
              ],
            },
            {
              name: 'sourceVariantName',
              tags: [
                {
                  value: 'sourceTagValue',
                },
                {
                  value: 'sourceTagValue',
                },
              ],
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: {
            name: 'office desk',
            tags: {value: 'adjustable', $length: 3},
            $length: 4,
          },
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
            {
              name: 'office desk',
              tags: [
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
                {
                  value: 'adjustable',
                },
              ],
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema, apolloServerManager);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should allow overrides of specific array items using longhand notation', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
            },
            {
              name: 'sourceVariantName',
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [{}, {name: 'coffee table'}, {}, {name: 'office desk'}],
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [
            {
              name: 'office desk',
            },
            {
              name: 'coffee table',
            },
            {
              name: 'office desk',
            },
            {
              name: 'office desk',
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should allow overrides of specific array items using shorthand notation', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
            },
            {
              name: 'sourceVariantName',
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: {
            name: 'office desk',
            $1: {name: 'coffee table'},
            $length: 4,
          },
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [
            {
              name: 'office desk',
            },
            {
              name: 'coffee table',
            },
            {
              name: 'office desk',
            },
            {
              name: 'office desk',
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should allow custom meta prefix', async function () {
    // $ is the meta prefix by default
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
            },
            {
              name: 'sourceVariantName',
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: {name: 'office desk', $_$length: 4},
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
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
            {
              name: 'office desk',
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema, null,{
      metaPropertyPrefix: '$_$',
    });
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should not merge value if seed defines an array but source does not', async function () {
    //array type mismatch
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: {
            name: 'sourceVariantName',
          },
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [{}, {}, {}, {name: 'office desk'}],
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: {
            name: 'sourceVariantName',
          },
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(1);
    expect(mergeResult.warnings).toContain(
      'Skipping "data.product.variants": source doesn\'t define an array at this path.'
    );
  });

  it('should return warnings if seed defines extra fields inside arrays', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
            },
            {
              name: 'sourceVariantName',
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: {name: 'office desk', color: 'blue', $length: 4},
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
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
            {
              name: 'office desk',
            },
          ],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(1);
    expect(mergeResult.warnings).toContain(
      'Skipping "data.product.variants.color": key not found in source.'
    );
  });

  it('should handle empty arrays in seed', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: [
            {
              name: 'sourceVariantName',
            },
            {
              name: 'sourceVariantName',
            },
          ],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [],
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: [],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should handle arrays with primitive values', async function () {
    const source = {
      data: {
        product: {
          name: 'sourceProductName',
          variants: ['no', 'no'],
        },
      },
    };

    const seed = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: ['', '', '', 'yes'],
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          name: 'Flagship Desk',
          variants: ['yes', 'yes', 'yes', 'yes'],
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should handle null values in mock correctly', async function () {
    const source = {
      data: {
        product: null,
      },
    };

    const seed = {
      data: {
        product: {
          manufacturer: {
            name: 'I Build Desks',
          },
        },
      },
    };

    const expectedResult = {
      data: {
        product: {
          manufacturer: {
            name: 'I Build Desks',
          },
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });

  it('should merge data that matches valid type in interface', async function () {
    const source = {
      data: {
        item: {
          __typename: 'ItemOne',
          id: 'hello',
          someField1: 'hello',
          nested: {
            name: 'hello'
          }
        },
      },
    };

    const seed = {
      data: {
        item: {
          __typename: 'ItemTwo',
          id: 'string',
          someField2: 'string',
          nested: {
            name: 'string'
          }
        },
      },
    };

    const expectedResult = {
      data: {
        item: {
          __typename: 'ItemTwo',
          id: 'string',
          someField2: 'string',
          nested: {
            name: 'string'
          }
        },
      },
    };

    const mergeResult = await deepMerge(source, seed, schema, apolloServerManager);
    expect(mergeResult.data).toEqual(expectedResult);
    expect(mergeResult.warnings.length).toEqual(0);
  });
});
