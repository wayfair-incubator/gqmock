import fetch from 'node-fetch';
import createApp from './utilities/createApp';
import {Seed} from './seed/types';
import {Response} from 'express';

type MockServerOptions = {
  port?: number;
};

class MockServer {
  readonly port;
  private appServer;
  constructor(options: MockServerOptions) {
    this.port = options.port || 5000;
  }

  async start(): Promise<void> {
    const app = createApp();

    this.appServer = await app.listen({port: this.port}, () =>
      console.log({
        message: `🚀 GraphQL Mocking Service listening on ${this.port}`,
      })
    );
  }

  async stop(): Promise<void> {
    await this.appServer.close();
  }

  registerSchema(schema: string): Promise<Response> {
    return fetch(`http://localhost:${this.port}/graphql/register-schema`, {
      method: 'post',
      body: JSON.stringify({
        schema,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  registerOperationSeed(
    sequenceId: string,
    {
      operationName,
      operationSeedResponse,
      operationMatchArguments,
      options = {},
    }: Seed
  ): Promise<Response> {
    return fetch(`http://localhost:${this.port}/seed/operation`, {
      method: 'post',
      body: JSON.stringify({
        sequenceId,
        operationName,
        operationSeedResponse,
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
    {
      operationName,
      operationSeedResponse,
      operationMatchArguments,
      options = {},
    }: Seed
  ): Promise<Response> {
    return fetch(`http://localhost:${this.port}/seed/network-error`, {
      method: 'post',
      body: JSON.stringify({
        sequenceId,
        operationName,
        operationSeedResponse,
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
