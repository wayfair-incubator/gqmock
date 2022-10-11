import {ApolloServer, gql} from 'apollo-server';
import {buildSubgraphSchema} from '@apollo/subgraph';
import {parse} from 'graphql';

type SchemaRegistrationOptions = {
  subgraph: boolean;
};

export default class ApolloServerManager {
  private apolloServerInstance;
  get apolloServer(): ApolloServer | null {
    return this.apolloServerInstance || null;
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
  }
}
