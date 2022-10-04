import cloneDeep from 'lodash/cloneDeep';
import escapeStringRegexp from 'escape-string-regexp';

function buildRollingKey(currentKey, key) {
  if (currentKey) {
    return `${currentKey}.${key}`;
  }

  return key;
}

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

function merge(
  source,
  target,
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
  Object.entries(target).forEach(([targetKey, targetValue]) => {
    const newRollingKey = buildRollingKey(rollingKey, targetKey);
    if (source[targetKey]) {
      if (
        targetValue instanceof Object &&
        Number.isInteger(targetValue[`${metaPropertyPrefix}length`])
      ) {
        source[targetKey] = [
          ...Array(targetValue[`${metaPropertyPrefix}length`]).keys(),
        ].map(() => {
          return cloneDeep(
            merge(source[targetKey][0], targetValue, {
              rollingKey: newRollingKey,
              warnings,
              metaPropertyPrefix,
            }).data
          );
        });

        const shorthandOverrides = buildShorthandOverridesMap(
          targetValue,
          metaPropertyPrefix
        );
        Object.entries(shorthandOverrides).forEach(([index, overrideValue]) => {
          source[targetKey][index] = cloneDeep(
            merge(source[targetKey][index], overrideValue, {
              rollingKey: newRollingKey,
              warnings,
              metaPropertyPrefix,
            }).data
          );
        });
      } else if (Array.isArray(targetValue)) {
        const lastTargetArrayItem = targetValue[targetValue.length - 1];
        const sourceItem = source[targetKey][0];
        if (Array.isArray(source[targetKey])) {
          source[targetKey] = targetValue.map((item) => {
            if (lastTargetArrayItem instanceof Object) {
              if (Object.entries(item).length) {
                return cloneDeep(
                  merge(sourceItem, item, {
                    rollingKey: newRollingKey,
                    warnings,
                    metaPropertyPrefix,
                  }).data
                );
              }
              return cloneDeep(
                merge(sourceItem, lastTargetArrayItem, {
                  rollingKey: newRollingKey,
                  warnings,
                  metaPropertyPrefix,
                }).data
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
        return merge(source[targetKey], targetValue, {
          rollingKey: newRollingKey,
          warnings,
          metaPropertyPrefix,
        });
      } else {
        source[targetKey] = targetValue;
      }
    } else if (source[targetKey] === null) {
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

function deepMerge(
  source: Record<string, unknown>,
  seed: Record<string, unknown>,
  options = {}
): {
  data: Record<string, unknown>;
  warnings: string[];
} {
  const {data, warnings} = merge(cloneDeep(source), seed, options);
  return {
    data,
    warnings: Array.from(warnings),
  };
}

export default deepMerge;
