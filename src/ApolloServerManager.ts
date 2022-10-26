import {ApolloServer} from 'apollo-server';
import {buildSubgraphSchema} from '@apollo/subgraph';
import {
  GraphQLSchema,
  parse,
  buildSchema,
  visit,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  GraphQLObjectType,
} from 'graphql';
import {Headers} from 'apollo-server-env';

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
    const augmentedSchemaSource = this.getAugmentedSchema(schemaSource);
    if (options.subgraph) {
      this.graphQLSchema = buildSubgraphSchema(parse(augmentedSchemaSource));
    } else {
      this.graphQLSchema = buildSchema(augmentedSchemaSource);
    }

    this.apolloServerInstance = new ApolloServer({
      typeDefs: this.graphQLSchema,
      mocks: true,
    });
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

  private getAugmentedSchema(schemaSource: string): string {
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

  getFieldName(__typename: string): string {
    return `${this.privateQueryPrefix}_${__typename}`;
  }

  buildPrivateQuery(__typename: string): {
    query: string;
    typeName: string;
  } {
    const type = this.graphQLSchema?.getType(__typename) as GraphQLObjectType;
    if (!type) {
      throw new Error(`Type ${__typename} not found in schema`);
    }

    const fieldNames = type.astNode?.fields?.map((field) => field.name.value);
    const typeName = this.getFieldName(__typename);
    return {
      query: `query ${this.getFieldName('privateQuery')} {
      ${typeName} {
        ${fieldNames?.join('\n')}
      }
    }`,
      typeName,
    };
  }

  async getNewMock(
    target: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const {query, typeName} = this.buildPrivateQuery(
      target.__typename as string
    );
    const queryResult = await this.apolloServer?.executeOperation({
      query,
      variables: {},
      operationName: `${this.privateQueryPrefix}_privateQuery`,
      http: {
        url: '',
        method: '',
        headers: new Headers(),
      },
    });

    return queryResult?.data ? queryResult.data[typeName] : {};
  }
}
