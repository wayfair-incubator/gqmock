import express from 'express';
import createRouter from '../utilities/createRouter';
import ApolloServerManager from '../ApolloServerManager';

const schemaRoutes = (
  {apolloServerManager} = {
    apolloServerManager: new ApolloServerManager(),
  }
): express.Router => {
  const router = createRouter();

  router.post('/register', (req, res) => {
    const {schema, options = {}} = req.body;

    try {
      apolloServerManager.createApolloServer(schema, options);
    } catch (error) {
      throw new Error(
        `Unable to register GraphQL schema: ${(error as Error).message}.`
      );
    }

    res.sendStatus(204);
  });

  return router;
};

export default schemaRoutes;
