const GraphqlMockingService = require('./dist/GraphqlMockingService').default;

async function start() {
  const mockingService = new GraphqlMockingService({port: 5000});
  await mockingService.start();
}

start();
