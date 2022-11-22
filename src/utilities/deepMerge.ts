import cloneDeep from 'lodash/cloneDeep';
import escapeStringRegexp from 'escape-string-regexp';
import ApolloServerManager from '../ApolloServerManager';
import buildPrivateTypeQuery from './buildPrivateTypeQuery';

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
 * @param {object} seed - Object to be merged into source
 * @param {object} graphqlContext - Properties required for making supplemental GraphQL queries
 * @param {string} graphqlContext.query - Original GraphQL query
 * @param {object} graphqlContext.variables - GraphQL query variables
 * @param {string} graphqlContext.operationName - GraphQL operation name
 * @param {ApolloServerManager} graphqlContext.apolloServerManager - ApolloServerManager instance
 * @param {boolean} graphqlContext.augmentQuery - Flag to add private typenames to all selection sets
 * @param {object} options - Merge options
 * @returns {object} A merged object and a list of warnings
 */
async function deepMerge(
  source: Record<string, unknown>,
  seed: Record<string, unknown>,
  graphqlContext: {
    query: string;
    variables: undefined | Record<string, unknown>;
    operationName: string;
    apolloServerManager: ApolloServerManager;
    augmentQuery: boolean;
  },
  options = {}
): Promise<{
  data: Record<string, unknown>;
  warnings: string[];
}> {
  const {query, variables, operationName, apolloServerManager, augmentQuery} =
    graphqlContext;
  const warnings = new Set<string>();
  /**
   * Returns the result of merging target into source
   *
   * @param {object} source - Source for the merge
   * @param {object} target - Object to be merged into source
   * @param {object} options - Supplemental options for recursive 'merge' calls
   * @param {string} options.rollingKey - A dot separated key path to keep track of the merge depth
   * @param {string} options.metaPropertyPrefix - Prefix used to denote short-hand notation. Default: $
   * @returns {Promise<object>} A merged object and a list of warnings
   */
  async function merge(
    source,
    target,
    {rollingKey = '', metaPropertyPrefix = '$'}
  ) {
    if (
      source.__typename &&
      target.__typename &&
      source?.__typename !== target?.__typename
    ) {
      source = await apolloServerManager.getNewMock({
        query,
        typeName: target.__typename,
        operationName,
        rollingKey,
      });
    }

    for (const [targetKey, targetValue] of Object.entries(target)) {
      const newRollingKey = buildRollingKey(rollingKey, targetKey);
      if (source[targetKey]) {
        if (
          targetValue instanceof Object &&
          Number.isInteger(targetValue[`${metaPropertyPrefix}length`])
        ) {
          const sourceItem = source[targetKey][0];
          source[targetKey] = [];
          for (let i = 0; i < targetValue[`${metaPropertyPrefix}length`]; i++) {
            source[targetKey].push(
              await merge(sourceItem, targetValue, {
                rollingKey: newRollingKey,
                metaPropertyPrefix,
              })
            );
          }

          const shorthandOverrides = buildShorthandOverridesMap(
            targetValue,
            metaPropertyPrefix
          );

          for (const [index, overrideValue] of Object.entries(
            shorthandOverrides
          )) {
            source[targetKey][index] = await merge(
              cloneDeep(source[targetKey][index]),
              overrideValue,
              {rollingKey: newRollingKey, metaPropertyPrefix}
            );
          }
        } else if (Array.isArray(targetValue)) {
          const sourceItem = source[targetKey][0];
          if (Array.isArray(source[targetKey])) {
            source[targetKey] = [];
            for (const item of targetValue) {
              if (!(item instanceof Object)) {
                source[targetKey].push(item);
              } else {
                // build a new query to fetch an array item at path
                // this should happen regardless of overrides
                const newSourceItemTypename =
                  sourceItem.__typename ||
                  sourceItem[apolloServerManager.getFieldName('typename')];
                const newSourceItemQuery = buildPrivateTypeQuery({
                  query: apolloServerManager.addTypenameFieldsToQuery(query),
                  typeName: newSourceItemTypename,
                  operationName,
                  rollingKey: newRollingKey,
                  apolloServerManager,
                });
                const newSourceItem =
                  await apolloServerManager.executeOperation({
                    query: newSourceItemQuery,
                    variables: {},
                    operationName:
                      apolloServerManager.getFieldName('privateQuery'),
                  });
                const newSourceItemData =
                  newSourceItem.data[
                    apolloServerManager.getFieldName(newSourceItemTypename)
                  ];
                if (Object.entries(item).length) {
                  source[targetKey].push(
                    await merge(cloneDeep(newSourceItemData), item, {
                      rollingKey: newRollingKey,
                      metaPropertyPrefix,
                    })
                  );
                } else {
                  source[targetKey].push(newSourceItemData);
                }
              }
            }
          } else {
            warnings.add(
              `Skipping "${newRollingKey}": source doesn't define an array at this path.`
            );
          }
        } else if (targetValue instanceof Object) {
          source[targetKey] = await merge(source[targetKey], targetValue, {
            rollingKey: newRollingKey,
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
    return source;
  }

  let data;
  if (augmentQuery) {
    const typenamedQuery = apolloServerManager.addTypenameFieldsToQuery(query);
    const newSource = await apolloServerManager.executeOperation({
      query: typenamedQuery,
      variables: variables || {},
      operationName,
    });

    data = await merge(cloneDeep(newSource), seed, options);
  } else {
    data = await merge(cloneDeep(source), seed, options);
  }

  apolloServerManager.deletePrivateTypenameFields(data);

  return {
    data,
    warnings: Array.from(warnings),
  };
}

export default deepMerge;
