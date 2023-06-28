import express from 'express';
import cors from 'cors';
import graphqlRoutes from '../routes/graphql';
import seedRoutes from '../routes/seed';
import schemaRoutes from '../routes/schema';
import SeedManager from '../seed/SeedManager';
import ApolloServerManager from '../ApolloServerManager';
import {PlaygroundUI} from '../PlaygroundUI';

/**
 * @param root0
 * @param root0.playgroundUI
 * @param root0.port
 * @returns {express.Express} An express server instance
 */
export default function createApp({
  playgroundUI,
  port,
}: {
  playgroundUI: PlaygroundUI;
  port: number;
}): express.Express {
  const app = express();
  const seedManager = new SeedManager();
  const apolloServerManager = new ApolloServerManager();

  app.use(express.json({limit: '5mb'}));
  app.use(cors());
  app.use(
    express.urlencoded({
      extended: true,
      limit: '5mb',
    })
  );

  app.get('/health-check', (req, res) => {
    res.status(200).json({
      status: 'pass',
    });
    return res;
  });

  app.use(
    '/graphql',
    graphqlRoutes({playgroundUI, seedManager, apolloServerManager, port})
  );
  app.use('/schema', schemaRoutes({apolloServerManager}));
  app.use('/seed', seedRoutes({seedManager}));

  return app;
}
