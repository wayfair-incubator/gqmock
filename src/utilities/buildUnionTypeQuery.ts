import {
  ASTNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  Kind,
  OperationDefinitionNode,
  parse,
  print,
} from 'graphql';
import ApolloServerManager from '../ApolloServerManager';

/**
 *
 * @param {object} root0 - parameters
 * @param {string} root0.query - Original GraphQL query with inline fragments
 * @param {string} root0.typeName - Type to fetch
 * @param {string} root0.operationName - GraphQL operation name
 * @param {string} root0.rollingKey - Dot separated object path
 * @param {ApolloServerManager} root0.apolloServerManager - ApolloServerManager instance
 * @returns {string} GraphQL query for a single type in a union
 */
export default function ({
  query,
  typeName,
  operationName,
  rollingKey,
  apolloServerManager,
}: {
  query: string;
  typeName: string;
  operationName: string;
  rollingKey: string;
  apolloServerManager: ApolloServerManager;
}): string {
  const keys = rollingKey.replace(/^data\./, '').split('.');
  const queryAst = parse(query);
  let node = queryAst.definitions.find((definition) => {
    return (
      definition.kind === Kind.OPERATION_DEFINITION &&
      definition.name &&
      definition.name.value === operationName
    );
  }) as OperationDefinitionNode;

  while (keys.length) {
    const key = keys.shift();
    let _node;
    if (node) {
      for (const selection of node.selectionSet.selections) {
        if (
          selection.kind === Kind.FIELD &&
          (selection.name.value === key || selection.alias?.value === key)
        ) {
          _node = selection;
          break;
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          const correctSelection = selection.selectionSet.selections.find(
            (nestedSelection) => {
              if (nestedSelection.kind === Kind.FIELD) {
                return (
                  (nestedSelection.name &&
                    nestedSelection.name.value === key) ||
                  (nestedSelection.alias && nestedSelection.alias.value === key)
                );
              }

              return false;
            }
          );
          if (correctSelection) {
            _node = correctSelection;
            break;
          }
        } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
          const fragmentDefinition = queryAst.definitions.find(
            (definition) =>
              definition.kind === Kind.FRAGMENT_DEFINITION &&
              definition.name.value === selection.name.value
          );
          for (const fragmentSelection of (
            fragmentDefinition as FragmentDefinitionNode
          )?.selectionSet.selections) {
            if (
              fragmentSelection.kind === Kind.FIELD &&
              (fragmentSelection.name.value === key ||
                fragmentSelection.alias?.value === key)
            ) {
              _node = fragmentSelection;
              break;
            } else if (fragmentSelection.kind === Kind.INLINE_FRAGMENT) {
              const correctFragmentSelection =
                fragmentSelection.selectionSet.selections.find(
                  (nestedSelection) => {
                    if (nestedSelection.kind === Kind.FIELD) {
                      return (
                        (nestedSelection.name &&
                          nestedSelection.name.value === key) ||
                        (nestedSelection.alias &&
                          nestedSelection.alias.value === key)
                      );
                    }

                    return false;
                  }
                );
              if (correctFragmentSelection) {
                _node = correctFragmentSelection;
                break;
              }
            }
          }
        }
      }
    } else {
      break;
    }

    node = _node;
  }

  const fields: Array<FieldNode | InlineFragmentNode> = [];

  node?.selectionSet?.selections.forEach((selection) => {
    if (selection.kind === Kind.FIELD) {
      fields.push(selection);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      if (
        selection.typeCondition &&
        selection.typeCondition.name.value === typeName
      ) {
        fields.push(
          ...(selection.selectionSet.selections as Array<
            FieldNode | InlineFragmentNode
          >)
        );
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragmentDefinition = queryAst.definitions.find(
        (definition) =>
          definition.kind === Kind.FRAGMENT_DEFINITION &&
          definition.name.value === selection.name.value
      );
      (
        fragmentDefinition as FragmentDefinitionNode
      )?.selectionSet.selections.forEach((fragmentSelection) => {
        if (fragmentSelection.kind === Kind.FIELD) {
          fields.push(fragmentSelection);
        } else if (fragmentSelection.kind === Kind.INLINE_FRAGMENT) {
          if (
            fragmentSelection.typeCondition &&
            fragmentSelection.typeCondition.name.value === typeName
          ) {
            fields.push(
              ...(fragmentSelection.selectionSet.selections as Array<
                FieldNode | InlineFragmentNode
              >)
            );
          }
        }
      });
    }
  });

  const newQueryAst = {
    kind: Kind.DOCUMENT,
    definitions: [
      {
        kind: Kind.OPERATION_DEFINITION,
        operation: 'query',
        name: {
          kind: Kind.NAME,
          value: apolloServerManager.getFieldName('privateQuery'),
        },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: {
                kind: Kind.NAME,
                value: apolloServerManager.getFieldName(typeName),
              },
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: fields,
              },
            },
          ],
        },
      },
    ],
  };

  return print(newQueryAst as ASTNode);
}
