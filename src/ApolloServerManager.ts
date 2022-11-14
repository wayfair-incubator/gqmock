import {ApolloServer} from '@apollo/server';
import {buildSubgraphSchema} from '@apollo/subgraph';
import {
  GraphQLSchema,
  parse,
  visit,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  Kind,
  buildASTSchema,
  printSchema
} from 'graphql';
import {Headers} from 'node-fetch';
import {DocumentNode} from 'graphql/language/ast';
import buildUnionTypeQuery from './utilities/buildUnionTypeQuery';
import { addMocksToSchema } from "@graphql-tools/mock";
import { makeExecutableSchema } from "@graphql-tools/schema";

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

    const { fakerOptions } = options;

    console.log('52 schemaSource michal: ', schemaSource);
    try {
      // this.graphQLSchema = makeExecutableSchema(augmentedSchemaAst);
      this.apolloServerInstance = new ApolloServer({
        // typeDefs: makeExecutableSchema(schemaSource),
        // typeDefs: schemaSource,
        schema: addMocksToSchema({
          schema: this.graphQLSchema,
          // mocks: {}
        })
      });
      console.log('64 this.apolloServerInstance michal: ', this.apolloServerInstance);
    } catch (e) {
      console.log('61 e michal: ', e);
    }
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
        // headers: new Headers(),
      },
    });

    return queryResult?.data
      ? {...queryResult.data[this.getFieldName(typeName)]}
      : {};
  }
}
