import {v4 as uuidv4} from 'uuid';
import AsyncChainable from './utilities/AsyncChainable';
import MockServer from './MockServer';
import {
  NetworkErrorResponse,
  OperationMatchArguments,
  OperationSeedResponse,
  SeedOptions,
} from './seed/types';
import PrivatePromise from './utilities/PrivatePromise';

type GraphqlMockingContextOptions = {
  server: MockServer;
  sequenceId?: string;
};

export default class GraphqlMockingContext extends AsyncChainable {
  readonly sequenceId;
  private server;
  constructor(private options: GraphqlMockingContextOptions) {
    super();
    this.sequenceId = options.sequenceId || uuidv4();
    this.server = options.server;
  }

  operation(
    operationName: string,
    seedResponse: OperationSeedResponse,
    operationMatchArguments?: OperationMatchArguments,
    options: SeedOptions = {}
  ): Promise<GraphqlMockingContext> {
    return this.chain(
      new PrivatePromise(async (resolve) => {
        const serverResponse = await this.server.registerOperationSeed(
          this.sequenceId,
          {
            operationName,
            seedResponse,
            operationMatchArguments,
            options,
          }
        );
        resolve(serverResponse);
      })
    );
  }

  async networkError(
    operationName: string,
    seedResponse: NetworkErrorResponse,
    operationMatchArguments?: OperationMatchArguments,
    options: SeedOptions = {}
  ): Promise<GraphqlMockingContext> {
    return this.chain(
      new PrivatePromise(async (resolve) => {
        const serverResponse = await this.server.registerNetworkErrorSeed(
          this.sequenceId,
          {
            operationName,
            seedResponse,
            operationMatchArguments,
            options,
          }
        );

        resolve(serverResponse);
      })
    );
  }
}
