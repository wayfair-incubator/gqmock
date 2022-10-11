# `@wayfair/gqmock`: GQMock - GraphQL Mocking Service

[![Release](https://img.shields.io/github/v/release/wayfair-incubator/gqmock?display_name=tag)](CHANGELOG.md)
[![Lint](https://github.com/wayfair-incubator/gqmock/actions/workflows/validate.yml/badge.svg?branch=main)](https://github.com/wayfair-incubator/gqmock/actions/workflows/validate.yml)
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
- [Usage](#usage)
  - [Unit testing](#unit-testing)
  - [Chaining multiple seeds](#chaining-multiple-seeds)
  - [Define operation seed response data](#define-operation-seed-response-data)
    - [List long-hand notation](#list-long-hand-notation)
    - [List short-hand notation](#list-short-hand-notation)
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

`@wayfair/gqlmock` offers an easy way to seed the data returned by GraphQL
operations. It masks the complexities of managing a mock server implementation
and instead exposes a declarative API for expressing the deterministic data you
need in your tests. There is no additional overhead for adding more tests to
your test suite, and because each test has a unique context, running tests in
parallel is 💯 supported!

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

| Parameter Name      | Required | Description                      | Type    | Default |
| ------------------- | -------- | -------------------------------- | ------- | ------- |
| `port`              | No       | Port used to run the mock server | number  | 5000    |
| `subgraph`          | No       | Enable subgraph schema support   | boolean | false   |

#### `async GraphqlMockingService.start`

Starts the mocking server.

#### `async GraphqlMockingService.stop`

Stops the mocking server.

#### `async GraphqlMockingService.registerSchema`

Registers a schema with the mock server.

| Parameter Name | Required | Description            | Type   | Default |
| -------------- | -------- | ---------------------- | ------ | ------- |
| `schema`       | Yes      | A valid GraphQL schema | string |         |

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

| Parameter Name                 | Required | Description                                                                            | Type     | Default                    |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------- | -------- | -------------------------- |
| `operationName`                | Yes      | Name of the GraphQL operation                                                          | string   |                            |
| `operationSeedResponse`        | Yes      | See specific properties                                                                | object   |                            |
| `operationSeedResponse.data`   | No       | Data to be merged with the default apollo server mock                                  | object   | {}                         |
| `operationSeedResponse.errors` | No       | Errors to return                                                                       | object[] |                            |
| `operationMatchArguments`      | No       | Params used for matching a seed with GraphQL operations. By default matching is exact. | object   | {}                         |
| `options`                      | No       | See specific properties                                                                | object   | {}                         |
| `options.usesLeft`             | No       | Uses left before discarding the seed                                                   | number   | seed doesn't get discarded |
| `options.partialArgs`          | No       | Allow partial matching of query arguments with the seed arguments                      | boolean  | false                      |

#### `async GraphqlMockingContext.networkError`

Registers a seed for a network error.

| Parameter Name                 | Required | Description                                                                            | Type     | Default                    |
| ------------------------------ | -------- | -------------------------------------------------------------------------------------- | -------- | -------------------------- |
| `operationName`                | Yes      | Name of the GraphQL operation                                                          | string   |                            |
| `operationSeedResponse`        | Yes      | Seed to be merged with the default apollo server mock                                  | object   |                            |
| `operationSeedResponse.data`   | No       | Data to be merged with the default apollo server mock                                  | object   | {}                         |
| `operationSeedResponse.errors` | No       | Errors to return                                                                       | object[] |                            |
| `operationMatchArguments`      | No       | Params used for matching a seed with GraphQL operations. By default matching is exact. | object   | {}                         |
| `options`                      | No       | See specific properties                                                                | object   | {}                         |
| `options.usesLeft`             | No       | Uses left before discarding the seed                                                   | number   | seed doesn't get discarded |
| `options.partialArgs`          | No       | Allow partial matching of query arguments with the seed arguments                      | boolean  | false                      |

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

`data` is one of the allowed properties for `operationSeedResponse` registration
parameter. It is supposed to mimic the query response defined by the registered
schema. As such, `data` will be a composition of objects and arrays all the way
to primitive leaf fields. You can define objects in the following way:

```javascript
const operationSeedResponse = {
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
const operationSeedResponse = {
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
elements. In this notation, the last element is treated as the blueprint for
_all_ elements for the array. However, this blueprint can be overridden by
defining an element in any index other than the last index.

##### List short-hand notation

The same lists can be defined using `$length` to define how many elements a list
should have. `$<index>` is used to override selected items in the list. The
prefix for both operations can be defined when the mocking service is
initialized.

```javascript
const operationSeedResponse = {
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
