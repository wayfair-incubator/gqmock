import {doesFieldExistOnType, getFieldsOnType} from '../validate';
import {buildSchema} from 'graphql';

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

describe('doesFieldExistOnType', () => {
  it('handles valid field on type', () => {
    const result = doesFieldExistOnType({
      field: 'someField1',
      type: 'ItemOne',
      schema,
    });

    expect(result).toBe(true);
  });

  it('handles invalid field on type', () => {
    const result = doesFieldExistOnType({
      field: 'someField1',
      type: 'ItemTwo',
      schema,
    });

    expect(result).toBe(false);
  });

  it('throws if type is not found', () => {
    expect(() =>
      doesFieldExistOnType({
        field: 'someField1',
        type: 'MissingType',
        schema,
      })
    ).toThrowError(`graphql type for MissingType not found`);
  });

  it('throws if type is not an object', () => {
    expect(() =>
      doesFieldExistOnType({
        field: 'someField1',
        type: 'SomeEnum',
        schema,
      })
    ).toThrowError(`SomeEnum is not an object type`);
  });
});

describe('getFieldsOnType', () => {
  it('returns fields on type', () => {
    const result = getFieldsOnType({
      type: 'ItemOne',
      schema,
    });

    expect(result).toStrictEqual(['id', 'someField1']);
  });

  it('throws if type is not found', () => {
    expect(() =>
      getFieldsOnType({
        type: 'MissingType',
        schema,
      })
    ).toThrowError(`graphql type for MissingType not found`);
  });

  it('throws if type is not an object', () => {
    expect(() =>
      getFieldsOnType({
        type: 'SomeEnum',
        schema,
      })
    ).toThrowError(`SomeEnum is not an object type`);
  });
});
