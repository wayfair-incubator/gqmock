# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### TBA

## [v0.5.3] - 2022-12-15

### Fixed

- Fix static mocks for shorthand notation arrays


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
