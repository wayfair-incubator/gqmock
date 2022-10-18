import {ApolloServer, gql} from 'apollo-server';
import {buildSubgraphSchema} from '@apollo/subgraph';
import {GraphQLSchema, parse, buildSchema} from 'graphql';

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

  createApolloServer(schema: string, options: SchemaRegistrationOptions): void {
    if (options.subgraph) {
      this.apolloServerInstance = new ApolloServer({
        typeDefs: buildSubgraphSchema(parse(schema)),
        mocks: true,
      });
    } else {
      this.apolloServerInstance = new ApolloServer({
        typeDefs: gql`
          ${schema}
        `,
        mocks: true,
      });
    }

    this.graphQLSchema = buildSchema(schema);
  }
}
