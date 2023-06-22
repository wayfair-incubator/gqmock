import express from 'express';
import cors from 'cors';
import graphqlRoutes from '../routes/graphql';
import seedRoutes from '../routes/seed';
import schemaRoutes from '../routes/schema';
import SeedManager from '../seed/SeedManager';
import ApolloServerManager from '../ApolloServerManager';

/**
 * @returns {express.Express} An express server instance
 */
export default function createApp(): express.Express {
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

  app.use('/graphql', graphqlRoutes({seedManager, apolloServerManager}));
  app.use('/schema', schemaRoutes({apolloServerManager}));
  app.use('/seed', seedRoutes({seedManager}));

  return app;
}
