import express from 'express';
import {parse} from 'graphql';
import GraphqlMockingContextLogger from '../utilities/Logger';
import createRouter from '../utilities/createRouter';
import SeedManager from '../seed/SeedManager';
import ApolloServerManager from '../ApolloServerManager';
import {SeededOperationResponse} from '../seed/types';

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

    try {
      // verify the query is valid
      parse(query);
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
    const queryWithoutFragments = apolloServerManager.expandFragments(query);
    const typenamedQuery = apolloServerManager.addTypenameFieldsToQuery(
      queryWithoutFragments
    );

    let operationResult;
    try {
      const apolloServer = apolloServerManager.apolloServer;
      if (apolloServer) {
        operationResult = await apolloServerManager.executeOperation({
          query: typenamedQuery,
          variables,
          operationName,
        });
      }
    } catch (error) {
      res.status(500);
      res.json({
        message: 'GraphQL operation execution error',
        error,
      });
      return;
    }

    const {operationResponse, statusCode} =
      await seedManager.mergeOperationResponse({
        operationName,
        variables,
        operationMock: operationResult,
        sequenceId,
        apolloServerManager,
        query: typenamedQuery,
      });

    res.status(statusCode);

    if (operationResponse === null || operationResponse instanceof Object) {
      if (operationResponse && 'warnings' in operationResponse) {
        (operationResponse as SeededOperationResponse).warnings?.forEach(
          (warning) => {
            GraphqlMockingContextLogger.warning(warning, sequenceId);
          }
        );
      }
      res.json(operationResponse);
    } else {
      res.send(operationResponse);
    }
  });

  router.post('/register-schema', (req, res) => {
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

export default graphqlRoutes;
