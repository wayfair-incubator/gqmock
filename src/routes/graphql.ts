import express from 'express';
import {Headers} from 'apollo-server-env';

import {parse} from 'graphql';
import GraphqlMockingContextLogger from '../utilities/Logger';
import createRouter from '../utilities/createRouter';
import SeedManager from '../seed/SeedManager';
import ApolloServerManager from '../ApolloServerManager';

const graphqlRoutes = (
  {seedManager, apolloServerManager} = {
    seedManager: new SeedManager(),
    apolloServerManager: new ApolloServerManager(),
  }
): express.Router => {
  const router = createRouter();
  router.post('/', async (req, res) => {
    const {query = '', variables = {}, operationName} = req.body;
    const sequenceId = req.headers['mocking-sequence-id'] as string;

    if (!operationName) {
      res.status(400);
      res.json({
        message: 'GraphQL operation name is required',
      });
      return;
    }

    let parsedQuery;
    try {
      parsedQuery = parse(query);
    } catch (error) {
      GraphqlMockingContextLogger.error(
        `Invalid GraphQL Query: ${(error as Error).message}`,
        sequenceId
      );
      res.status(422);
      res.json({
        message: 'Invalid GraphQL Query',
        error,
      });
      return;
    }

    let operationResult;
    try {
      const apolloServer = apolloServerManager.apolloServer;
      if (apolloServer) {
        operationResult = await apolloServer.executeOperation({
          query: parsedQuery,
          variables,
          operationName,
          http: {
            url: '',
            method: '',
            headers: new Headers(),
          },
        });
      }
      delete operationResult.http;
    } catch (error) {
      res.status(500);
      res.send({
        message: 'GraphQL operation execution error',
        error,
      });
      return;
    }

    const seededQueryResult = await seedManager.mergeOperationResponse({
      operationName,
      variables,
      operationMock: operationResult,
      sequenceId,
      apolloServerManager,
    });

    seededQueryResult.warnings?.forEach((warning) => {
      GraphqlMockingContextLogger.warning(warning, sequenceId);
    });

    res.send(seededQueryResult);
  });

  router.post('/register-schema', (req, res) => {
    const {schema, options} = req.body;
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

export default graphqlRoutes;
