import cloneDeep from 'lodash/cloneDeep';
import escapeStringRegexp from 'escape-string-regexp';
import ApolloServerManager from '../ApolloServerManager';

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
 * @param {string} graphqlContext.operationName - GraphQL operation name
 * @param {ApolloServerManager} graphqlContext.apolloServerManager - ApolloServerManager instance
 * @param {object} options - Merge options
 * @param graphqlContext.variables
 * @returns {object} A merged object and a list of warnings
 */
async function deepMerge(
  source: Record<string, unknown>,
  seed: Record<string, unknown>,
  graphqlContext: {
    query: string;
    variables: Record<string, unknown>;
    operationName: string;
    apolloServerManager: ApolloServerManager;
  },
  options = {}
): Promise<{
  data: Record<string, unknown>;
  warnings: string[];
}> {
  const {query, operationName, apolloServerManager, variables} = graphqlContext;
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
        variables,
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
            // build a new query to fetch an array item at path
            // this should happen regardless of overrides
            const newSourceItemData = await apolloServerManager.getNewMock({
              query,
              variables,
              typeName: sourceItem.__typename,
              operationName,
              rollingKey: newRollingKey,
            });
            source[targetKey].push(
              await merge(newSourceItemData, targetValue, {
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
          if (Array.isArray(source[targetKey])) {
            const sourceItem = {...source[targetKey][0]};
            source[targetKey] = [];
            for (const item of targetValue) {
              if (!(item instanceof Object)) {
                source[targetKey].push(item);
              } else {
                // build a new query to fetch an array item at path
                // this should happen regardless of overrides
                const newSourceItemData = await apolloServerManager.getNewMock({
                  query,
                  variables,
                  typeName: sourceItem.__typename,
                  operationName,
                  rollingKey: newRollingKey,
                });
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

  const data = await merge(source, seed, options);

  return {
    data,
    warnings: Array.from(warnings),
  };
}

export default deepMerge;
