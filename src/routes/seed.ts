import express from 'express';
import createRouter from '../utilities/createRouter';
import SeedManager, {SeedType} from '../seed/SeedManager';

const seedRoutes = (
  {seedManager} = {
    seedManager: new SeedManager(),
  }
): express.Router => {
  const router = createRouter();
  router.post('/operation', async (req, res) => {
    const {
      sequenceId,
      operationName,
      seedResponse,
      operationMatchArguments,
      options,
    } = req.body;
    seedManager.registerSeed(
      sequenceId,
      SeedType.Operation,
      {operationName, seedResponse, operationMatchArguments},
      options
    );
    res.sendStatus(201);
  });

  router.post('/network-error', async (req, res) => {
    const {
      sequenceId,
      operationName,
      seedResponse,
      operationMatchArguments,
      options,
    } = req.body;
    seedManager.registerSeed(
      sequenceId,
      SeedType.NetworkError,
      {operationName, seedResponse, operationMatchArguments},
      options
    );
    res.sendStatus(201);
  });

  return router;
};

export default seedRoutes;
