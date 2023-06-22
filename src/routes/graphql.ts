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
  // Allow additional information in the /graphql route to allow for common patterns
  // like putting operation names in the path for usage in APM modules
  router.post('/:operationName?', async (req, res) => {
    const {query = '', variables = {}} = req.body;
    const operationName = req.body.operationName || req.params.operationName;
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

    if (operationResponse === null) {
      res.end();
    } else if (operationResponse instanceof Object) {
      if ('warnings' in operationResponse) {
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

  return router;
};

export default graphqlRoutes;
