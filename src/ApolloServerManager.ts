import {ApolloServer, gql} from 'apollo-server';

export default class ApolloServerManager {
  private apolloServerInstance;
  get apolloServer(): ApolloServer | null {
    return this.apolloServerInstance || null;
  }

  createApolloServer(schema: string): void {
    this.apolloServerInstance = new ApolloServer({
      typeDefs: gql`
        ${schema}
      `,
      mocks: true,
    });
  }
}
