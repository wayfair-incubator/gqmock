# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v2.0.1] - 2024-09-09

### Fix

- Revert `@chalk` upgrade due to module import differences with previous version

## [v2.0.0] - 2024-09-09

### Chore

- Updated many dependencies of this library. See the package.json diff for
  details.

### Breaking

- `@faker-js/faker` is now a peer dependency and is required to be installed by
  consuming projects if that functionality is used.

## [v1.3.1] - 2024-02-08

### Fixed

- fix: support variables nested in query when making private queries

## [v1.3.0] - 2024-02-02

### Added

- feat: support nested faker configurations (for scalars, etc)

## [v1.2.2] - 2023-12-21

### Fixed

- fix: support multiple nodes in private queries

## [v1.2.1] - 2023-12-15

### Fixed

- fix: support unions when building private queries

## [v1.2.0] - 2023-11-01

### Added

- feat: allow explicit passing of cors options

## [v1.1.2] - 2023-08-21

### Fixed

- fix: handle null arguments

## [v1.1.1] - 2023-08-09

### Fixed

- fix: resolve matching arguments correctly + support nested arguments

## [v1.1.0] - 2023-06-28

### Added

- feat: add support for serving a GraphQL IDE from the mock servers `/graphql`
  route. Three options are available:
  - **DEFAULT** `GraphQLIDE.ApolloSandbox`: Serve's the
    [Apollo Sandbox](https://www.apollographql.com/docs/graphos/explorer/sandbox/)
    experience.
  - `GraphQLIDE.GraphiQL`: Serve's the latest version of
    [GraphiQL](https://github.com/graphql/graphiql/tree/main/packages/graphiql#readme)
  - `GraphQLIDE.None`: Disables the GraphQL IDE experience

### Fixed

- fix: don't require sequenceId when executing a query

## [v1.0.0] - 2023-06-22

### Breaking

- breaking: remove `/graphql/register-schema`. Use new `/schema/register`
  endpoint instead.

### Added

- feat: add new `/schema/register` endpoint
- feat: add support for operation names in `/graphql` path

## [v0.6.0] - 2023-02-28

### Added

- GQMock docker support to eliminate Node.js dependency

## [v0.5.4] - 2022-12-21

### Fixed

- Fix networkError seed behavior

### Added

- Documentation about the mock server endpoints for use cases without access to
  the Node.js API that comes with this module
- Documentation about using GQMock as a pure GraphQL HTTP server for local
  development

## [v0.5.3] - 2022-12-15

### Fixed

- Fix static mocks for shorthand notation arrays

### Added

- Added CORS to enable local development work

## [v0.5.2] - 2022-12-12

### Fixed

- Fix mock caching resulting in constant values for fields

## [v0.5.1] - 2022-11-22

### Fixed

- Fix overmocking of arrays seeded with longhand notation
- Improve mocking of unseeded array items
- Fix named fragments handling

## [v0.5.0] - 2022-11-16

### Feat

- Add [faker.js](https://fakerjs.dev/) support

## [v0.4.0] - 2022-11-08

### Feat

- Add support for aliases and fragment spread field selection

## [v0.3.1] - 2022-11-02

### Chore

- Simplify handling of GraphQL interfaces and unions

## [v0.3.0] - 2022-10-25

### Fixed

- Handle GraphQL interfaces and unions

## [v0.2.4] - 2022-10-17

### Fixed

- Handle falsy values correctly in merge logic

## [v0.2.3] - 2022-10-13

### Fixed

- Use deep compare for matching operation arguments

## [v0.2.2] - 2022-10-12

### Added

- Added seed matching logs

## [v0.2.1] - 2022-10-11

### Added

- generate .d.ts file during build

## [v0.2.0] - 2022-10-11

### Added

- Add support for subgraph schemas.
- Add the option to create multiple contexts with the same `sequenceId`

## [v0.1.0] - 2022-10-06

### Added

- Add initial library API
  - `GraphqlMockingService`
  - `GraphqlMockingContext`
- Add a README
- Add project configuration
