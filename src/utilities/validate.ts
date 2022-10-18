import {GraphQLSchema, Kind} from 'graphql';

export const doesFieldExistOnType = ({
  field,
  type,
  schema,
}: {
  field: string;
  type: string;
  schema: GraphQLSchema;
}): boolean => {
  const graphqlType = schema.getType(type);

  if (typeof graphqlType === 'undefined') {
    throw new Error(`graphql type for ${type} not found`);
  }

  if (graphqlType.astNode?.kind !== Kind.OBJECT_TYPE_DEFINITION) {
    throw new Error(`${type} is not an object type`);
  }

  return (
    typeof graphqlType.astNode.fields?.find(
      (objectField) => objectField.name.value === field
    ) !== 'undefined'
  );
};

export const getFieldsOnType = ({
  type,
  schema,
}: {
  type: string;
  schema: GraphQLSchema;
}): string[] => {
  const graphqlType = schema.getType(type);

  if (typeof graphqlType === 'undefined') {
    throw new Error(`graphql type for ${type} not found`);
  }

  if (graphqlType.astNode?.kind !== Kind.OBJECT_TYPE_DEFINITION) {
    throw new Error(`${type} is not an object type`);
  }

  return typeof graphqlType.astNode.fields !== 'undefined'
    ? graphqlType.astNode.fields?.map((field) => field.name.value)
    : [];
};
