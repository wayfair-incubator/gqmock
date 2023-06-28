# `@wayfair/gqmock`: GQMock - GraphQL Mocking Service

[![Release](https://img.shields.io/github/v/release/wayfair-incubator/gqmock?display_name=tag)](CHANGELOG.md)
[![Lint](https://github.com/wayfair-incubator/gqmock/actions/workflows/validate.yml/badge.svg?branch=main)](https://github.com/wayfair-incubator/gqmock/actions/workflows/validate.yml)
[![codecov](https://codecov.io/gh/wayfair-incubator/gqmock/branch/main/graph/badge.svg)][codecov]
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.0-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Maintainer](https://img.shields.io/badge/Maintainer-Wayfair-7F187F)](https://wayfair.github.io)

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [About The Project](#about-the-project)
  - [The problem](#the-problem)
  - [The solution](#the-solution)
- [Getting Started](#getting-started)
  - [Installation](#installation)
- [Library API](#library-api)
  - [`GraphqlMockingService`](#graphqlmockingservice)
    - [`async GraphqlMockingService.start`](#async-graphqlmockingservicestart)
    - [`async GraphqlMockingService.stop`](#async-graphqlmockingservicestop)
    - [`async GraphqlMockingService.registerSchema`](#async-graphqlmockingserviceregisterschema)
    - [`GraphqlMockingService.createContext`](#graphqlmockingservicecreatecontext)
  - [`GraphqlMockingContext`](#graphqlmockingcontext)
    - [`GraphqlMockingContext.sequenceId`](#graphqlmockingcontextsequenceid)
    - [`async GraphqlMockingContext.operation`](#async-graphqlmockingcontextoperation)
    - [`async GraphqlMockingContext.networkError`](#async-graphqlmockingcontextnetworkerror)
  - [Mock server endpoints](#mock-server-endpoints)
    - [GET `http:localhost:<port>/graphql`](#get-httplocalhostportgraphql)
    - [POST `http:localhost:<port>/graphql`](#post-httplocalhostportgraphql)
    - [POST `http:localhost:<port>/schema/register`](#post-httplocalhostportschemaregister)
    - [POST `http:localhost:<port>/seed/operation`](#post-httplocalhostportseedoperation)
    - [POST `http:localhost:<port>/seed/network-error`](#post-httplocalhostportseednetwork-error)
- [Usage](#usage)
  - [Unit testing](#unit-testing)
  - [Chaining multiple seeds](#chaining-multiple-seeds)
  - [Define operation seed response data](#define-operation-seed-response-data)
    - [Defining lists in response data](#defining-lists-in-response-data)
      - [List long-hand notation](#list-long-hand-notation)
      - [List short-hand notation](#list-short-hand-notation)
  - [Faker.js support](#fakerjs-support)
  - [Setup outside of testing environment](#setup-outside-of-testing-environment)
    - [Required client setup](#required-client-setup)
    - [Required server setup](#required-server-setup)
  - [Docker support](#docker-support)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)
- [Acknowledgements](#acknowledgements)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## About The Project

### The problem

There isn't an easy way to customize mock data coming from Apollo Server without
writing logic directly into the mock service implementation. This requires
understanding the mock server templating implementation and hand rolling
maintenance of that implementation directly.

As these custom mocking implementations grow, logic inside of mock servers
becomes complex and counter-productive. Writing automated tests for both
Frontends and Backends becomes more difficult and coupled in undesired ways.

### The solution

`@wayfair/gqmock` offers an easy way to seed the data returned by GraphQL
operations. It masks the complexities of managing a mock server implementation
and instead exposes a declarative API for expressing the deterministic data you
need in your tests. There is no additional overhead for adding more tests to
your test suite, and because each test has a unique context, running tests in
parallel is 💯 supported!

`@wayfair/gqmock` is an HTTP server which means that you can use it also outside
of test environment for fast feature development. On top of that, if you cannot
use the Node.js API that ships with this module, you can easily have the mock
server running in a container and call the endpoints documented below to
interact with the server.

## Getting Started

To get a local copy up and running follow these simple steps.

### Installation

This module is distributed via [npm][npm] which is bundled with [node][node] and
should be installed as one of your project's `devDependencies`:

```
npm install --save-dev @wayfair/gqmock
```

or

for installation via [yarn][yarn]

```
yarn add --dev @wayfair/gqmock
```

## Library API

### `GraphqlMockingService`

| Parameter Name | Required | Description                      | Type    | Default |
| -------------- | -------- | -------------------------------- | ------- | ------- |
| `port`         | No       | Port used to run the mock server | number  | 5000    |
| `subgraph`     | No       | Enable subgraph schema support   | boolean | false   |

#### `async GraphqlMockingService.start`

Starts the mocking server.

#### `async GraphqlMockingService.stop`

Stops the mocking server.

#### `async GraphqlMockingService.registerSchema`

Registers a schema with the mock server.

| Parameter Name        | Required | Description                                           | Type    | Default |
| --------------------- | -------- | ----------------------------------------------------- | ------- | ------- |
| `schema`              | Yes      | A valid GraphQL schema                                | string  |         |
| `options`             | No       | Schema registration options                           | object  |         |
| `options.fakerConfig` | No       | Map of fields to return realistic data using faker.js | object  | {}      |
| `options.subgraph`    | No       | Is the schema a subgraph schema                       | boolean | false   |

#### `GraphqlMockingService.createContext`

Creates a new `GraphqlMockingContext` instance with a unique `sequenceId`

| Parameter Name | Required | Description                         | Type   | Default |
| -------------- | -------- | ----------------------------------- | ------ | ------- |
| `sequenceId`   | No       | A string to be used as a sequenceId | string | uuid    |

### `GraphqlMockingContext`

#### `GraphqlMockingContext.sequenceId`

A unique string used to match GraphQL requests with registered seeds.
`sequenceId` can be attached to requests using a custom Apollo Link:

```javascript
import {ApolloLink} from '@apollo/client';

const mockServiceLink = new ApolloLink((operation, forward) => {
  operation.setContext(({headers = {}}) => ({
    headers: {
      ...headers,
      ...(sequenceId ? {'mocking-sequence-id': sequenceId} : {}),
    },
  }));

  return forward(operation);
});
```

#### `async GraphqlMockingContext.operation`

Registers a seed for a GraphQL operation.

| Parameter Name            | Required | Description                                                                            | Type     | Default                    |
| ------------------------- | -------- | -------------------------------------------------------------------------------------- | -------- | -------------------------- |
| `operationName`           | Yes      | Name of the GraphQL operation                                                          | string   |                            |
| `seedResponse`            | Yes      | See specific properties                                                                | object   |                            |
| `seedResponse.data`       | No       | Data to be merged with the default apollo server mock                                  | object   | {}                         |
| `seedResponse.errors`     | No       | Errors to return                                                                       | object[] |                            |
| `operationMatchArguments` | No       | Params used for matching a seed with GraphQL operations. By default matching is exact. | object   | {}                         |
| `options`                 | No       | See specific properties                                                                | object   | {}                         |
| `options.usesLeft`        | No       | Uses left before discarding the seed                                                   | number   | seed doesn't get discarded |
| `options.partialArgs`     | No       | Allow partial matching of query arguments with the seed arguments                      | boolean  | false                      |
| `options.statusCode`      | No       | HTTP response status code of the response                                              | number   | 200                        |

#### `async GraphqlMockingContext.networkError`

Registers a seed for a network error.

| Parameter Name            | Required | Description                                                                            | Type                     | Default                    |
| ------------------------- | -------- | -------------------------------------------------------------------------------------- | ------------------------ | -------------------------- |
| `operationName`           | Yes      | Name of the GraphQL operation                                                          | string                   |                            |
| `seedResponse`            | Yes      | Error that will be sent from /graphql endpoint                                         | object or string or null |                            |
| `operationMatchArguments` | No       | Params used for matching a seed with GraphQL operations. By default matching is exact. | object                   | {}                         |
| `options`                 | No       | See specific properties                                                                | object                   | {}                         |
| `options.usesLeft`        | No       | Uses left before discarding the seed                                                   | number                   | seed doesn't get discarded |
| `options.partialArgs`     | No       | Allow partial matching of query arguments with the seed arguments                      | boolean                  | false                      |
| `options.statusCode`      | No       | HTTP response status code of the response                                              | number                   | 500                        |

### Mock server endpoints

#### GET `http:localhost:<port>/graphql/:operationName?`

This endpoint supports serving a GraphQL IDE from the mock servers `/graphql`
route. Three options are available:

- **DEFAULT** `GraphQLIDE.ApolloSandbox`: Serve's the
  [Apollo Sandbox](https://www.apollographql.com/docs/graphos/explorer/sandbox/)
  experience.
- `GraphQLIDE.GraphiQL`: Serve's the latest version of
  [GraphiQL](https://github.com/graphql/graphiql/tree/main/packages/graphiql#readme)
- `GraphQLIDE.None`: Disables the GraphQL IDE experience, and therefore this
  endpoint

#### POST `http:localhost:<port>/graphql/:operationName?`

Send GraphQL queries to this endpoint to retrieve mocked data. Seeds are
overlaid onto the response if they were previously registered. The
`mocking-sequence-id` needs to be sent with every request. This can be done
automatically by configuring a custom Apollo Link for an Apollo Client. In order
to use the registered seeds, the `mocking-sequence-id` header needs to match the
`sequeneceId` used when the seed was registered.

| Parameter Name                | Required | Description                                                         | Type   | Default |
| ----------------------------- | -------- | ------------------------------------------------------------------- | ------ | ------- |
| `body.operationName`_\*_      | Yes      | Name of the GraphQL operation                                       | string |         |
| `body.query`                  | Yes      | GraphQL query                                                       | string |         |
| `body.variables`              | No       | GraphQL query variables                                             | object | {}      |
| `headers.mocking-sequence-id` | No       | Unique id of the use case context used to connect or separate seeds | string |         |

_\*: `body.operationName` is not required if the `operationName` is provided in
the path._

#### POST `http:localhost:<port>/schema/register`

Schema needs to be registered first before mocked data can be retrieved.

| Parameter Name                | Required | Description                                                         | Type    | Default |
| ----------------------------- | -------- | ------------------------------------------------------------------- | ------- | ------- |
| `body.schema`                 | Yes      | GraphQL SDL schema                                                  | string  |         |
| `body.options`                | No       | See specific options                                                | object  | {}      |
| `body.options.fakerConfig`    | No       | Faker.js config for GraphQL type fields                             | object  | {}      |
| `body.options.subgraph`       | No       | Is the schema a subgraph schema                                     | boolean | false   |
| `headers.mocking-sequence-id` | Yes      | Unique id of the use case context used to connect or separate seeds | string  |

#### POST `http:localhost:<port>/seed/operation`

Use this endpoint to register operation seeds. You can register multiple seeds
for the same operation. If there are multiple matched seeds then the one
registered first will be used.

| Parameter Name                 | Required | Description                                                                            | Type     | Default                    |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------- | -------- | -------------------------- |
| `body.sequenceId`              | Yes      | Unique id of the use case context used to connect or separate seeds                    | string   |                            |
| `body.operationName`           | Yes      | Name of the GraphQL operation                                                          | string   |                            |
| `body.seedResponse`            | Yes      | See specific properties                                                                | object   |                            |
| `body.seedResponse.data`       | No       | Data to be merged with the default apollo server mock                                  | object   | {}                         |
| `body.seedResponse.errors`     | No       | Errors to return                                                                       | object[] |                            |
| `body.operationMatchArguments` | No       | Params used for matching a seed with GraphQL operations. By default matching is exact. | object   | {}                         |
| `body.options.usesLeft`        | No       | Uses left before discarding the seed                                                   | number   | seed doesn't get discarded |
| `body.options.partialArgs`     | No       | Allow partial matching of query arguments with the seed arguments                      | boolean  | false                      |
| `body.options.statusCode`      | No       | HTTP response status code of the response                                              | number   | 200                        |

#### POST `http:localhost:<port>/seed/network-error`

Use this endpoint to register network errors caused by executing GraphQL
queries. For example, you can simulate unauthorized access.

| Parameter Name                 | Required | Description                                                                            | Type                     | Default                    |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------- | ------------------------ | -------------------------- |
| `body.sequenceId`              | Yes      | Unique id of the use case context used to connect or separate seeds                    | string                   |                            |
| `body.operationName`           | Yes      | Name of the GraphQL operation                                                          | string                   |                            |
| `body.seedResponse`            | Yes      | Error that will be sent from /graphql endpoint                                         | object or string or null |                            |
| `body.operationMatchArguments` | No       | Params used for matching a seed with GraphQL operations. By default matching is exact. | object                   | {}                         |
| `body.options`                 | No       | See specific properties                                                                | object                   | {}                         |
| `body.options.usesLeft`        | No       | Uses left before discarding the seed                                                   | number                   | seed doesn't get discarded |
| `body.options.partialArgs`     | No       | Allow partial matching of query arguments with the seed arguments                      | boolean                  | false                      |
| `body.options.statusCode`      | No       | HTTP response status code of the response                                              | number                   | 500                        |

## Usage

### Unit testing

```javascript
describe('App', function () {
  let mockingService;
  beforeAll(async () => {
    mockingService = new GraphqlMockingService({port: 5000});
    await mockingService.start();

    const schema = fs.readFileSync(
      path.resolve(__dirname, './schema.graphql'),
      'utf-8'
    );
    await mockingService.registerSchema(schema);
  });

  afterAll(async () => {
    await mockingService.stop();
  });

  it('should work', async () => {
    const seed = {
      data: {
        booksByGenreCursorConnection: {
          edges: [
            {},
            {},
            {
              node: {
                id: 'Qm9vazo1',
                title: 'Harry Potter and the Chamber of Secrets',
                author: {
                  id: 'QXV0aG9yOjE=',
                  fullName: 'J. K. Rowling',
                  __typename: 'Author',
                },
                __typename: 'Book',
              },
              __typename: 'BooksEdge',
            },
          ],
        },
      },
    };

    const mockingContext = mockingService.createContext();
    await mockingContext.operation('GetBooks', seed, {genre: 'ALL'});

    render(<App sequenceId={mockingContext.sequenceId} />);
    const books = await screen.findAllByText(
      'Harry Potter and the Chamber of Secrets'
    );
    expect(books.length).toEqual(3);
  });
});
```

### Chaining multiple seeds

```javascript
const context = service.createContext();
await context.operation(/* ... */).operation(/* ... */).networkError(/* ... */);
```

### Define operation seed response data

`data` is one of the allowed properties for `seedResponse` registration
parameter. It is supposed to mimic the query response defined by the registered
schema. As such, `data` will be a composition of objects and arrays all the way
to primitive leaf fields. You can define objects in the following way:

```javascript
const seedResponse = {
  data: {
    productBySku: {
      name: 'Flagship Table with Sku',
    },
  },
};
```

#### Defining lists in response data

##### List long-hand notation

```javascript
const seedResponse = {
  data: {
    productBySku: {
      name: 'Flagship Table with Sku',
      variants: [
        {},
        {
          name: 'standing',
          tags: [{}, {value: 'adjustable'}],
        },
        {},
        {
          name: 'office',
          tags: [{}, {value: 'adjustable'}],
        },
      ],
    },
  },
};
```

In this example, `variants` is a list of 4 elements, and `tags` is a list of 2
elements. Only variants 2 and 4 will have seeded values.

##### List short-hand notation

The same lists can be defined using `$length` to define how many elements a list
should have. `$<index>` is used to override selected items in the list. The
prefix for both operations can be defined when the mocking service is
initialized.

```javascript
const seedResponse = {
  data: {
    productBySku: {
      name: 'Flagship Table with Sku',
      variants: {
        name: 'office',
        tags: {value: 'adjustable', $length: 2},
        $length: 4,
        $2: {name: 'standing', tags: {value: 'adjustable', $length: 2}},
      },
    },
  },
};
```

### Faker.js support

```javascript
const schema = `
    type ProductVariant {
        name: String
        color: String
        tags: [Tag]
        pictures: [Picture]
    }

    type Dimensions {
        length: Int
        width: Int
        height: Int
    }

    type Product {
        name: String
        variants: [ProductVariant]
        dimensions: Dimensions
    }`;

const fakerConfig = {
  Product: {
    name: {
      method: 'random.alpha',
      args: {count: 5, casing: 'upper', bannedChars: ['A']},
    },
  },
  Dimensions: {
    length: {
      method: 'random.numeric',
      args: 2,
    },
    width: {
      method: 'random.numeric',
      args: [2],
    },
    height: {
      method: 'random.numeric',
      args: 3,
    },
  },
  ProductVariant: {
    name: {
      method: 'random.words',
    },
  },
};

const mockingService = new GraphqlMockingService();
await mockingService.start();
await mockingService.registerSchema(schema, {fakerConfig});
```

```graphql
query getProduct {
  product {
    name
  }
}
```

will resolve as:

```json
{
  "data": {
    "product": {
      "name": "DTCIC"
    }
  }
}
```

### Setup outside of testing environment

#### Required client setup

- Create a custom link to attach `sequenceId` as a header if it is present.
- Configure it into your `ApolloClient`'s link chain

```typescript
import {ApolloLink, HttpLink, concat} from '@apollo/client';
import fetch from 'cross-fetch';

const setCustomHeaders = new ApolloLink((operation, forward) => {
  operation.setContext(({headers = {}}) => ({
    headers: {
      ...headers,
      ...(sequenceId ? {'mocking-sequence-id': sequenceId} : {}),
    },
  }));

  return forward(operation);
});

const httpLink = new HttpLink();

const client = new ApolloClient({
  // other configuration here
  link: concat(setCustomHeaders, httpLink),
});
```

#### Required server setup

Start the mocking server and register a schema

```typescript
import GraphqlMockingService from '@wayfair/gqmock';

const mockingService = new GraphqlMockingService({port: 5000});
await mockingService.start();
await mockingService.registerSchema(schema, options); // or register schema by calling the endpoint documented above
```

That's it. You can now register seeds and call `/graphql` endpoint to get seeded
data.

### Docker support

GQMock was written with Node.js in mind. However, the mocking server can be
dockerized and used in any environment. A docker image can be built at any time
by running

```shell
docker build . -t wayfair-incubator/gqmock
```

Then you can run the container

```shell
docker run -dp <port on local port>:5000 wayfair-incubator/gqmock
```

The running server accepts requests to all documented
[endpoints](#mock-server-endpoints) on the port specified when starting the
container.

## Roadmap

See the [open issues](https://github.com/wayfair-incubator/gqmock/issues) for a
list of proposed features (and known issues).

## Contributing

Contributions are what make the open source community such an amazing place to
learn, inspire, and create. Any contributions you make are **greatly
appreciated**. For detailed contributing guidelines, please see
[CONTRIBUTING.md](CONTRIBUTING.md)

## License

Distributed under the `MIT` License. See [`LICENSE`][license] for more
information.

## Contact

- **Mark Faga**: [Twitter](https://twitter.com/markjfaga)
- **Michal Mazur** [Email](mailto:michal.mazur221@gmail.com)

Project Link:
[https://github.com/wayfair-incubator/gqmock](https://github.com/wayfair-incubator/gqmock)

## Acknowledgements

This template was adapted from
[https://github.com/othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template).

[npm]: https://www.npmjs.com/
[yarn]: https://classic.yarnpkg.com
[node]: https://nodejs.org
[license]: https://github.com/wayfair-incubator/node-froid/blob/main/LICENSE
[codecov]: https://codecov.io/gh/wayfair-incubator/gqmock
