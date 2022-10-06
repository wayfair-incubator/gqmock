import {v4 as uuidv4} from 'uuid';
import AsyncChainable from './utilities/AsyncChainable';
import MockServer from './MockServer';
import {
  OperationMatchArguments,
  OperationSeedResponse,
  SeedOptions,
} from './seed/types';
import PrivatePromise from './utilities/PrivatePromise';

type GraphqlMockingContextOptions = {
  server: MockServer;
};

export default class GraphqlMockingContext extends AsyncChainable {
  readonly sequenceId;
  private server;
  constructor(private options: GraphqlMockingContextOptions) {
    super();
    this.sequenceId = uuidv4();
    this.server = options.server;
  }

  operation(
    operationName: string,
    operationSeedResponse: OperationSeedResponse,
    operationMatchArguments?: OperationMatchArguments,
    options: SeedOptions = {}
  ): Promise<GraphqlMockingContext> {
    return this.chain(
      new PrivatePromise(async (resolve) => {
        const serverResponse = await this.server.registerOperationSeed(
          this.sequenceId,
          {
            operationName,
            operationSeedResponse,
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
    operationSeedResponse: OperationSeedResponse,
    operationMatchArguments?: OperationMatchArguments,
    options: SeedOptions = {}
  ): Promise<GraphqlMockingContext> {
    return this.chain(
      new PrivatePromise(async (resolve) => {
        const serverResponse = await this.server.registerNetworkErrorSeed(
          this.sequenceId,
          {
            operationName,
            operationSeedResponse,
            operationMatchArguments,
            options,
          }
        );

        resolve(serverResponse);
      })
    );
  }
}
