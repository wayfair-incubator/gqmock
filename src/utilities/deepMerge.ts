import cloneDeep from 'lodash/cloneDeep';
import async from 'async';
import escapeStringRegexp from 'escape-string-regexp';
import {GraphQLObjectType} from 'graphql';
import {Headers} from 'apollo-server-env';
import ApolloServerManager from '../ApolloServerManager';

/**
 * Builds a query for one of the private queries added to the schema
 *
 * @param {string} __typename - GraphQL type
 * @param {object} apolloServerManager - ApolloServerManager instance with access to schema and apollo server
 * @returns {string} GraphQL query
 */
function buildPrivateQuery(__typename, apolloServerManager) {
  const type = apolloServerManager.schema?.getType(
    __typename
  ) as GraphQLObjectType;
  if (!type) {
    throw new Error(`Type ${__typename} not found in schema`);
  }

  const fieldNames = type.astNode?.fields?.map((field) => field.name.value);
  const typeName = `${apolloServerManager.privateQueryPrefix}_${__typename}`;
  return {
    query: `query ${apolloServerManager.privateQueryPrefix}_privateQuery {
      ${typeName} {
        ${fieldNames?.join('\n')}
      }
    }`,
    typeName,
  };
}

/**
 * Returns a mock with the correct type in case of a __typename mismatch between mock and seed
 *
 * @param {object} target - seed at a given path
 * @param {object} apolloServerManager - ApolloServerManager instance with access to schema and apollo server
 * @returns {object} Apollo Server mock
 */
async function getNewMock(target, apolloServerManager) {
  const {query, typeName} = buildPrivateQuery(
    target.__typename,
    apolloServerManager
  );
  const queryResult = await apolloServerManager.apolloServer?.executeOperation({
    query,
    variables: {},
    operationName: `${apolloServerManager.privateQueryPrefix}_privateQuery`,
    http: {
      url: '',
      method: '',
      headers: new Headers(),
    },
  });

  return queryResult?.data ? queryResult.data[typeName] : {};
}

/**
 * Append key to a path
 *
 * @param {string} currentKey - A dot separated object key path
 * @param {string} key - A key to append to the existing key path
 * @returns {string} A dot separated object key path
 */
function buildRollingKey(currentKey, key) {
  if (currentKey) {
    return `${currentKey}.${key}`;
  }

  return key;
}

/**
 * Creates a map of array item overrides based on the short-hand notation
 * Example: $2: {"doesn't": "matter"} means that element indexed 0 will be {"doesn't": "matter"}
 *
 * @param {object} object - A short-hand notation definition of a list
 * @param {string} metaPropertyPrefix - Prefix used to denote short-hand notation. Default: $
 * @returns {object} A map of array item overrides
 */
function buildShorthandOverridesMap(object, metaPropertyPrefix) {
  return Object.entries(object).reduce((map, [key, value]) => {
    const overrideIndexWithoutPrefix = Number.parseInt(
      key.replace(new RegExp(`^${escapeStringRegexp(metaPropertyPrefix)}`), '')
    );
    if (Number.isInteger(overrideIndexWithoutPrefix)) {
      map[overrideIndexWithoutPrefix] = value;
    }

    return map;
  }, {});
}

/**
 * Returns the result of merging target into source
 *
 * @param {object} source - Source for the merge
 * @param {object} target - Object to be merged into source
 * @param {object} apolloServerManager - ApolloServerManager instance with access to schema and apollo server
 * @param {object} root0 - Supplemental options for recursive 'merge' calls
 * @param {string} root0.rollingKey - A dot separated key path to keep track of the merge depth
 * @param {string[]} root0.warnings - A list of warnings, e.g. discrepancies between source and target
 * @param {string} root0.metaPropertyPrefix - Prefix used to denote short-hand notation. Default: $
 * @returns {Promise<object>} A merged object and a list of warnings
 */
async function merge(
  source,
  target,
  apolloServerManager: ApolloServerManager,
  {
    rollingKey = '',
    warnings = new Set(),
    metaPropertyPrefix = '$',
  }: {
    rollingKey?: string;
    warnings?: Set<string>;
    metaPropertyPrefix?: string;
  } = {}
): Promise<{
  data: Record<string, unknown>;
  warnings: Set<string>;
}> {
  if (
    source.__typename &&
    target.__typename &&
    source?.__typename !== target?.__typename
  ) {
    // merge the new mock into target to derive a new source object with proper nesting
    const newMock = await getNewMock(target, apolloServerManager);
    const modifiedSource = (
      await merge(cloneDeep(target), newMock, apolloServerManager, {
        rollingKey,
        warnings: new Set(),
        metaPropertyPrefix,
      })
    ).data;

    // assign new values and delete old keys
    // note: cannot do source = modifiedSource because object references get broken and target ends up pointing to the wrong object
    Object.assign(source, modifiedSource);
    Object.keys(source).forEach((key) => {
      if (!modifiedSource.hasOwnProperty(key)) {
        delete source[key];
      }
    });
  }

  await async.eachLimit(
    Object.entries(target),
    1,
    async ([targetKey, targetValue]) => {
      const newRollingKey = buildRollingKey(rollingKey, targetKey);
      if (source[targetKey]) {
        if (
          targetValue instanceof Object &&
          Number.isInteger(targetValue[`${metaPropertyPrefix}length`])
        ) {
          source[targetKey] = await async.mapLimit(
            [...Array(targetValue[`${metaPropertyPrefix}length`]).keys()],
            1,
            async () => {
              return cloneDeep(
                (
                  await merge(
                    source[targetKey][0],
                    targetValue,
                    apolloServerManager,
                    {
                      rollingKey: newRollingKey,
                      warnings,
                      metaPropertyPrefix,
                    }
                  )
                ).data
              );
            }
          );

          const shorthandOverrides = buildShorthandOverridesMap(
            targetValue,
            metaPropertyPrefix
          );
          await async.eachLimit(
            Object.entries(shorthandOverrides),
            1,
            async ([index, overrideValue]) => {
              source[targetKey][index] = cloneDeep(
                (
                  await merge(
                    source[targetKey][index],
                    overrideValue,
                    apolloServerManager,
                    {
                      rollingKey: newRollingKey,
                      warnings,
                      metaPropertyPrefix,
                    }
                  )
                ).data
              );
            }
          );
        } else if (Array.isArray(targetValue)) {
          const lastTargetArrayItem = targetValue[targetValue.length - 1];
          const sourceItem = source[targetKey][0];
          if (Array.isArray(source[targetKey])) {
            source[targetKey] = await async.mapLimit(
              targetValue,
              1,
              async (item) => {
                if (lastTargetArrayItem instanceof Object) {
                  if (Object.entries(item).length) {
                    return cloneDeep(
                      (
                        await merge(sourceItem, item, apolloServerManager, {
                          rollingKey: newRollingKey,
                          warnings,
                          metaPropertyPrefix,
                        })
                      ).data
                    );
                  }

                  return cloneDeep(
                    (
                      await merge(
                        sourceItem,
                        lastTargetArrayItem,
                        apolloServerManager,
                        {
                          rollingKey: newRollingKey,
                          warnings,
                          metaPropertyPrefix,
                        }
                      )
                    ).data
                  );
                }

                return lastTargetArrayItem;
              }
            );
          } else {
            warnings.add(
              `Skipping "${newRollingKey}": source doesn't define an array at this path.`
            );
          }
        } else if (targetValue instanceof Object) {
          return merge(source[targetKey], targetValue, apolloServerManager, {
            rollingKey: newRollingKey,
            warnings,
            metaPropertyPrefix,
          });
        } else {
          source[targetKey] = targetValue;
        }
      } else if (
        source[targetKey] === null ||
        source[targetKey] === false ||
        source[targetKey] === 0 ||
        source[targetKey] === ''
      ) {
        source[targetKey] = targetValue;
      } else {
        if (targetKey.indexOf(metaPropertyPrefix) === 0) {
          //ignore shorthand meta properties
        } else {
          warnings.add(`Skipping "${newRollingKey}": key not found in source.`);
        }
      }
    }
  );

  return {
    data: source,
    warnings,
  };
}

/**
 * Returns the result of merging target into source
 *
 * @param {object} source - Source for the merge
 * @param {object} seed - Object to be merged into source
 * @param {object} apolloServerManager - Schema used for source and target data
 * @param {object} options - Merge options
 * @returns {object} A merged object and a list of warnings
 */
async function deepMerge(
  source: Record<string, unknown>,
  seed: Record<string, unknown>,
  apolloServerManager: ApolloServerManager,
  options = {}
): Promise<{
  data: Record<string, unknown>;
  warnings: string[];
}> {
  const {data, warnings} = await merge(
    cloneDeep(source),
    seed,
    apolloServerManager,
    options
  );
  return {
    data,
    warnings: Array.from(warnings),
  };
}

export default deepMerge;
