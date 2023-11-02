import express from 'express';
import cors from 'cors';
import graphqlRoutes from '../routes/graphql';
import seedRoutes from '../routes/seed';
import schemaRoutes from '../routes/schema';
import SeedManager from '../seed/SeedManager';
import ApolloServerManager from '../ApolloServerManager';
import {GraphQLIDE} from '../GraphQLIDE';

/**
 * @param {object} root0 - The root object
 * @param {GraphQLIDE} root0.graphQLIDE - The type of GraphQL IDE to use
 * @param {corsOptions} root0.corsOptions - Options for cors configuration
 * @param {number} root0.port - The port to run the server on
 * @returns {express.Express} An express server instance
 */
export default function createApp({
  graphQLIDE,
  port,
  corsOptions,
}: {
  graphQLIDE: GraphQLIDE;
  port: number;
  corsOptions: any; // eslint-disable-line
}): express.Express {
  const app = express();
  const seedManager = new SeedManager();
  const apolloServerManager = new ApolloServerManager();

  app.use(express.json({limit: '5mb'}));
  app.use(corsOptions ? cors(corsOptions) : cors());
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
    graphqlRoutes({graphQLIDE, seedManager, apolloServerManager, port})
  );
  app.use('/schema', schemaRoutes({apolloServerManager}));
  app.use('/seed', seedRoutes({seedManager}));

  return app;
}
