import GraphqlMockingContext from './GraphqlMockingContext';
import MockServer from './MockServer';

type GraphqlMockingServiceOptions = {
  port?: number;
  subgraph?: boolean;
};

export default class GraphqlMockingService {
  readonly server;
  private subgraph;
  constructor(private options: GraphqlMockingServiceOptions = {}) {
    this.server = new MockServer({port: options.port});
    this.subgraph = options.subgraph || false;
  }

  async start(): Promise<void> {
    await this.server.start();
  }

  async stop(): Promise<void> {
    await this.server.stop();
  }

  async registerSchema(schema: string): Promise<void> {
    await this.server.registerSchema(schema, {subgraph: this.subgraph});
  }

  createContext(sequenceId?: string): GraphqlMockingContext {
    return new GraphqlMockingContext({server: this.server, sequenceId});
  }
}
