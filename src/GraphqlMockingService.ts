import GraphqlMockingContext from './GraphqlMockingContext';
import {PlaygroundUI} from './PlaygroundUI';
import MockServer from './MockServer';

type GraphqlMockingServiceOptions = {
  port?: number;
  subgraph?: boolean;
  playgroundUI?: PlaygroundUI;
};

export default class GraphqlMockingService {
  readonly server;
  private subgraph;
  constructor(private options: GraphqlMockingServiceOptions = {}) {
    this.server = new MockServer({
      port: options.port,
      playgroundUI: options.playgroundUI,
    });
    this.subgraph = options.subgraph || false;
  }

  async start(): Promise<void> {
    await this.server.start();
  }

  async stop(): Promise<void> {
    await this.server.stop();
  }

  async registerSchema(schema: string, {fakerConfig = {}} = {}): Promise<void> {
    await this.server.registerSchema(schema, {
      subgraph: this.subgraph,
      fakerConfig,
    });
  }

  createContext(sequenceId?: string): GraphqlMockingContext {
    return new GraphqlMockingContext({server: this.server, sequenceId});
  }
}
