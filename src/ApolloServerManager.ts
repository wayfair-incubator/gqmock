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
} from 'graphql';
import {DocumentNode} from 'graphql/language/ast';
import buildUnionTypeQuery from './utilities/buildUnionTypeQuery';
import {addMocksToSchema} from '@graphql-tools/mock';
import {faker} from '@faker-js/faker';

const GQMOCK_QUERY_PREFIX = 'gqmock';

type SchemaRegistrationOptions = {
  subgraph: boolean;
  fakerConfig: Record<string, Record<string, Record<string, string>>>;
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

    const {fakerConfig = {}} = options;

    this.apolloServerInstance = new ApolloServer({
      schema: addMocksToSchema({
        schema: this.graphQLSchema,
        mocks: this.createCustomMocks(fakerConfig),
      }),
    });
  }

  private createCustomMocks(fakerConfig) {
    const mocks = {};
    Object.entries(fakerConfig).forEach(([typeName, typeConfig]) => {
      Object.entries(
        typeConfig as Record<string, Record<string, string>>
      ).forEach(([fieldName, fakerFieldConfig]) => {
        mocks[typeName] ??= {};
        const fakerKeys = fakerFieldConfig.method.split('.');
        let fakerMethod;
        if (fakerKeys.length) {
          fakerMethod = faker;
          while (fakerKeys.length) {
            const fakerKey = fakerKeys.shift() as string;
            fakerMethod = fakerMethod[fakerKey];
            if (!fakerMethod) {
              break;
            }
          }
        }
        if (fakerMethod) {
          mocks[typeName][fieldName] = () => {
            if (Array.isArray(fakerFieldConfig.args)) {
              return fakerMethod(...fakerFieldConfig.args);
            } else if (!!fakerFieldConfig.args) {
              return fakerMethod(fakerFieldConfig.args);
            } else {
              return fakerMethod();
            }
          };
        }
      });
    });

    return mocks;
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
    const queryResult = (await this.apolloServer
      ?.executeOperation({
        query: newQuery,
        variables: {},
        operationName: this.getFieldName('privateQuery'),
      })
      .then((response) => response.body)
      .then((body) => {
        if (body.kind === 'single') {
          return body.singleResult;
        } else if (body.kind === 'incremental') {
          return {
            initialResult: body.initialResult,
            subsequentResults: body.subsequentResults,
          };
        }
      })) as {
      data: Record<string, object>;
    };

    return queryResult?.data
      ? {...queryResult.data[this.getFieldName(typeName)]}
      : {};
  }
}
