import {ApolloServer} from 'apollo-server';
import {buildSubgraphSchema} from '@apollo/subgraph';
import {
  GraphQLSchema,
  parse,
  visit,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  GraphQLObjectType,
  Kind,
  buildASTSchema,
} from 'graphql';
import {Headers} from 'apollo-server-env';
import {DocumentNode} from 'graphql/language/ast';
import buildUnionTypeQuery from './utilities/buildUnionTypeQuery';

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
    const augmentedSchemaAst = this.getAugmentedSchema(schemaSource);
    if (options.subgraph) {
      this.graphQLSchema = buildSubgraphSchema(augmentedSchemaAst);
    } else {
      this.graphQLSchema = buildASTSchema(augmentedSchemaAst);
    }

    this.apolloServerInstance = new ApolloServer({
      typeDefs: this.graphQLSchema,
      mocks: true,
    });
  }

  private getAugmentedSchema(schemaSource: string): DocumentNode {
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

    const newAst = visit(parse(schemaSource), {
      ObjectTypeDefinition: extractTypes,
      ObjectTypeExtension: extractTypes,
    });

    queryType.fields = [
      ...queryType.fields,
      ...Array.from(newFields).map((typeName) => ({
        kind: Kind.FIELD_DEFINITION,
        name: {
          kind: Kind.NAME,
          value: this.getFieldName(typeName as string),
        },
        type: {
          kind: Kind.NAMED_TYPE,
          name: {
            kind: Kind.NAME,
            value: typeName,
          },
        },
      })),
    ];

    return newAst;
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

  async getNewMock2(
    target: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const {query, typeName} = this.buildPrivateQuery(
      target.__typename as string
    );
    const queryResult = await this.apolloServer?.executeOperation({
      query,
      variables: {},
      operationName: this.getFieldName('privateQuery'),
      http: {
        url: '',
        method: '',
        headers: new Headers(),
      },
    });

    return queryResult?.data ? queryResult.data[typeName] : {};
  }

  async getNewMock({
    query,
    typeName,
    operationName,
    rollingKey,
  }: {
    query: string;
    typeName: string;
    operationName: string;
    rollingKey: string;
  }): Promise<Record<string, unknown>> {
    const newQuery = buildUnionTypeQuery({
      query,
      typeName,
      operationName,
      rollingKey,
      apolloServerManager: this,
    });
    const queryResult = await this.apolloServer?.executeOperation({
      query: newQuery,
      variables: {},
      operationName: this.getFieldName('privateQuery'),
      http: {
        url: '',
        method: '',
        headers: new Headers(),
      },
    });

    return queryResult?.data
      ? {...queryResult.data[this.getFieldName(typeName)]}
      : {};
  }
}
