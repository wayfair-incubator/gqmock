import {ApolloServer} from 'apollo-server';
import {buildSubgraphSchema} from '@apollo/subgraph';
import {
  GraphQLSchema,
  parse,
  buildSchema,
  visit,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
} from 'graphql';

const GQMOCK_QUERY_PREFIX = 'gqmock';

type SchemaRegistrationOptions = {
  subgraph: boolean;
};

export default class ApolloServerManager {
  private apolloServerInstance;
  private graphQLSchema: GraphQLSchema | null = null;
  get apolloServer(): ApolloServer | null {
    return this.apolloServerInstance || null;
  }

  get schema(): GraphQLSchema | null {
    return this.graphQLSchema;
  }

  get privateQueryPrefix(): string {
    return GQMOCK_QUERY_PREFIX;
  }

  createApolloServer(
    schemaSource: string,
    options: SchemaRegistrationOptions
  ): void {
    const augmentedSchemaSource = this.buildCustomizedSchema(schemaSource);
    if (options.subgraph) {
      this.graphQLSchema = buildSubgraphSchema(parse(augmentedSchemaSource));
      this.apolloServerInstance = new ApolloServer({
        typeDefs: this.graphQLSchema,
        mocks: true,
      });
    } else {
      this.graphQLSchema = buildSchema(schemaSource);
      this.apolloServerInstance = new ApolloServer({
        typeDefs: this.graphQLSchema,
        mocks: true,
      });
    }
  }

  private addQueryFields(newFields, schemaSource) {
    return `
      ${schemaSource}
      
      extend type Query {
        ${newFields
          .map(
            (fieldName) => `${GQMOCK_QUERY_PREFIX}_${fieldName}: ${fieldName}`
          )
          .join('\n')}
      }
    `;
  }

  buildCustomizedSchema(schemaSource: string): string {
    const newFields = new Set();
    let queryType;

    const extractTypes = (
      node: ObjectTypeDefinitionNode | ObjectTypeExtensionNode
    ) => {
      if (node.name.value === 'Query' && !queryType) {
        queryType = node;
      } else {
        newFields.add(node.name.value);
      }
      return node;
    };

    visit(parse(schemaSource), {
      ObjectTypeDefinition: extractTypes,
      ObjectTypeExtension: extractTypes,
    });

    return this.addQueryFields(Array.from(newFields), schemaSource);
  }
}
