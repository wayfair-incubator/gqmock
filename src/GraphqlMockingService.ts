import GraphqlMockingContext from './GraphqlMockingContext';
import MockServer from './MockServer';

type GraphqlMockingServiceOptions = {
  port?: number;
};

export default class GraphqlMockingService {
  readonly server;
  constructor(private options: GraphqlMockingServiceOptions = {}) {
    this.server = new MockServer({port: options.port});
  }

  async start(): Promise<void> {
    await this.server.start();
  }

  async stop(): Promise<void> {
    await this.server.stop();
  }

  async registerSchema(schema: string): Promise<void> {
    await this.server.registerSchema(schema);
  }

  createContext(): GraphqlMockingContext {
    return new GraphqlMockingContext({server: this.server});
  }
}
