import fetch, {Response} from 'node-fetch';
import createApp from './utilities/createApp';
import {Seed} from './seed/types';
import {GraphQLIDE} from './GraphQLIDE';

type MockServerOptions = {
  port?: number;
  graphQLIDE?: GraphQLIDE;
  corsOptions?: any; // eslint-disable-line
};

type SchemaRegistrationOptions = {
  subgraph: boolean;
};

class MockServer {
  readonly port: number;
  readonly graphQLIDE: GraphQLIDE;
  readonly corsOptions: any; // eslint-disable-line

  private appServer;
  constructor(options: MockServerOptions) {
    this.port = options.port || 5000;
    this.graphQLIDE = options.graphQLIDE || GraphQLIDE.ApolloSandbox;
    this.corsOptions = options.corsOptions;
  }

  async start(): Promise<void> {
    const app = createApp({
      graphQLIDE: this.graphQLIDE,
      port: this.port,
      corsOptions: this.corsOptions,
    });

    this.appServer = await app.listen({port: this.port}, () =>
      console.log(
        `🚀 GQMock - GraphQL Mocking Service listening on ${this.port}`
      )
    );
  }

  async stop(): Promise<void> {
    await this.appServer.close();
  }

  registerSchema(
    schema: string,
    options: SchemaRegistrationOptions
  ): Promise<Response> {
    return fetch(`http://localhost:${this.port}/schema/register`, {
      method: 'post',
      body: JSON.stringify({
        schema,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  registerOperationSeed(
    sequenceId: string,
    {operationName, seedResponse, operationMatchArguments, options = {}}: Seed
  ): Promise<Response> {
    return fetch(`http://localhost:${this.port}/seed/operation`, {
      method: 'post',
      body: JSON.stringify({
        sequenceId,
        operationName,
        seedResponse,
        operationMatchArguments,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  registerNetworkErrorSeed(
    sequenceId: string,
    {operationName, seedResponse, operationMatchArguments, options = {}}: Seed
  ): Promise<Response> {
    return fetch(`http://localhost:${this.port}/seed/network-error`, {
      method: 'post',
      body: JSON.stringify({
        sequenceId,
        operationName,
        seedResponse,
        operationMatchArguments,
        options,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export default MockServer;
