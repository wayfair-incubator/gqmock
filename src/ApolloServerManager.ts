import {ApolloServer} from 'apollo-server';
import {buildSubgraphSchema} from '@apollo/subgraph';
import {GraphQLSchema, parse, buildSchema, GraphQLObjectType} from 'graphql';
import {mergeSchemas} from '@graphql-tools/schema';

const GQMOCK_QUERY_PREFIX = 'gqmock';
const IGNORE_TYPES = [
  'Query',
  'Boolean',
  '__Schema',
  '__Type',
  '__TypeKind',
  '__Field',
  '__InputValue',
  '__EnumValue',
  '__Directive',
  '__DirectiveLocation',
];

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
    const executableSchema = buildSubgraphSchema(parse(schemaSource));
    const customizedSchema = this.buildCustomizedSchema(executableSchema);
    const mergedSchema = mergeSchemas({
      schemas: [executableSchema, customizedSchema],
    });
    this.graphQLSchema = mergedSchema;
    if (options.subgraph) {
      this.apolloServerInstance = new ApolloServer({
        typeDefs: mergedSchema,
        mocks: true,
      });
    } else {
      const executableSchema = buildSchema(schemaSource);
      const customizedSchema = this.buildCustomizedSchema(executableSchema);
      const mergedSchema = mergeSchemas({
        schemas: [executableSchema, customizedSchema],
      });
      this.graphQLSchema = mergedSchema;
      this.apolloServerInstance = new ApolloServer({
        typeDefs: mergedSchema,
        mocks: true,
      });
    }

    this.graphQLSchema = buildSchema(schemaSource);
  }

  buildCustomizedSchema(executableSchema: GraphQLSchema): GraphQLSchema {
    const typeMap = executableSchema.getTypeMap();
    const privateTypeQueries = Object.keys(new Object(typeMap)).reduce(
      (fields, typeName) => {
        if (!IGNORE_TYPES.includes(typeName)) {
          fields[`${GQMOCK_QUERY_PREFIX}_${typeName}`] = {
            type: executableSchema?.getType(typeName),
          };
        }

        return fields;
      },
      {}
    );

    const queryType = new GraphQLObjectType({
      name: 'Query',
      fields: privateTypeQueries,
    });
    return new GraphQLSchema({query: queryType});
  }
}
