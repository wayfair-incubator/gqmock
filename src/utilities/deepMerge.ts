import cloneDeep from 'lodash/cloneDeep';
import async from 'async';
import escapeStringRegexp from 'escape-string-regexp';
import {GraphQLSchema} from 'graphql';
import { Headers } from "apollo-server-env";

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
 * @param {object} schema - Schema used for source and target data
 * @param {object} root0 - Supplemental options for recursive 'merge' calls
 * @param {string} root0.rollingKey - A dot separated key path to keep track of the merge depth
 * @param {string[]} root0.warnings - A list of warnings, e.g. discrepancies between source and target
 * @param {string} root0.metaPropertyPrefix - Prefix used to denote short-hand notation. Default: $
 * @returns {object} A merged object and a list of warnings
 */
async function merge(
  source,
  target,
  schema: GraphQLSchema | null,
  apolloServerManager,
  {
    rollingKey = '',
    warnings = new Set(),
    metaPropertyPrefix = '$',
  }: {
    rollingKey?: string;
    warnings?: Set<string>;
    metaPropertyPrefix?: string;
  } = {}
): {
  data: Record<string, unknown>;
  warnings: Set<string>;
} {
  if (source.__typename && target.__typename && source.__typename !== target.__typename) {
    // typename mismatch detected
    // fetch a mock with the correct type
    const type = apolloServerManager.schema.getType(target.__typename);
    const fieldNames = type.astNode.fields.map(field => field.name.value);
    const typeName = `${apolloServerManager.privateQueryPrefix}_${target.__typename}`;
    const query = `query privateQuery {
      ${typeName} {
        ${fieldNames.join('\n')}
      }
    }`;

    const queryResult = await apolloServerManager.apolloServer.executeOperation({
      query,
      variables: {},
      operationName: 'privateQuery',
      http: {
        url: '',
        method: '',
        headers: new Headers(),
      },
    });

    // merge the new mock into target to derive a new source object with proper nesting
    const modifiedSource = (await merge(cloneDeep(target), queryResult.data[typeName], schema, apolloServerManager, {
      rollingKey,
      warnings: new Set(),
      metaPropertyPrefix,
    })).data;

    // assign new values and delete old keys
    // note: cannot do source = modifiedSource because object references get broken and target ends up pointing to the wrong object
    Object.assign(source, modifiedSource);
    Object.keys(source).forEach(key => {
      if (!modifiedSource.hasOwnProperty(key)) {
        delete source[key];
      }
    });
  }

  await async.eachLimit(Object.entries(target), 1,  async ([targetKey, targetValue]) => {
    const newRollingKey = buildRollingKey(rollingKey, targetKey);
    if (source[targetKey]) {
      if (
        targetValue instanceof Object &&
        Number.isInteger(targetValue[`${metaPropertyPrefix}length`])
      ) {
        source[targetKey] = await async.mapLimit([
          ...Array(targetValue[`${metaPropertyPrefix}length`]).keys(),
        ], 1, async () => {
          return cloneDeep(
            (await merge(source[targetKey][0], targetValue, schema, apolloServerManager,{
              rollingKey: newRollingKey,
              warnings,
              metaPropertyPrefix,
            })).data
          );
        });

        const shorthandOverrides = buildShorthandOverridesMap(
          targetValue,
          metaPropertyPrefix
        );
        await async.eachLimit(Object.entries(shorthandOverrides), 1, async ([index, overrideValue]) => {
          source[targetKey][index] = cloneDeep(
            (await merge(source[targetKey][index], overrideValue, schema, apolloServerManager, {
              rollingKey: newRollingKey,
              warnings,
              metaPropertyPrefix,
            })).data
          );
        });
      } else if (Array.isArray(targetValue)) {
        const lastTargetArrayItem = targetValue[targetValue.length - 1];
        const sourceItem = source[targetKey][0];
        if (Array.isArray(source[targetKey])) {
          source[targetKey] = await async.mapLimit(targetValue, 1, async (item) => {
            if (lastTargetArrayItem instanceof Object) {
              if (Object.entries(item).length) {
                return cloneDeep(
                  (await merge(sourceItem, item, schema, apolloServerManager,{
                    rollingKey: newRollingKey,
                    warnings,
                    metaPropertyPrefix,
                  })).data
                );
              }

              return cloneDeep(
                (await merge(sourceItem, lastTargetArrayItem, schema, apolloServerManager,{
                  rollingKey: newRollingKey,
                  warnings,
                  metaPropertyPrefix,
                })).data
              );
            }

            return lastTargetArrayItem;
          });
        } else {
          warnings.add(
            `Skipping "${newRollingKey}": source doesn't define an array at this path.`
          );
        }
      } else if (targetValue instanceof Object) {
        return merge(source[targetKey], targetValue, schema, apolloServerManager,{
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
  });

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
 * @param {object} schema - Schema used for source and target data
 * @param {object} options - Merge options
 * @returns {object} A merged object and a list of warnings
 */
async function deepMerge(
  source: Record<string, unknown>,
  seed: Record<string, unknown>,
  schema: GraphQLSchema | null,
  apolloServerManager,
  options = {}
): {
  data: Record<string, unknown>;
  warnings: string[];
} {
  const {data, warnings} = await merge(cloneDeep(source), seed, schema, apolloServerManager, options);
  return {
    data,
    warnings: Array.from(warnings),
  };
}

export default deepMerge;
