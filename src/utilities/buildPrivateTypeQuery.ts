import {
  ASTNode,
  FieldNode,
  FragmentSpreadNode,
  GraphQLSchema,
  InlineFragmentNode,
  Kind,
  OperationDefinitionNode,
  parse,
  print,
} from 'graphql';
import ApolloServerManager from '../ApolloServerManager';

/**
 *
 * @param {FieldNode} node - GraphQL FieldNode
 * @param {string} key - GraphQL node name or alias
 * @returns {boolean} - Whether node matches name or alias
 */
function keyMatchesFieldNode(node, key) {
  return (
    node.kind === Kind.FIELD &&
    (node.name?.value === key || node.alias?.value === key)
  );
}

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
  const interfaceImplementations =
    apolloServerManager.getInterfaceImplementations(
      apolloServerManager.schema as GraphQLSchema,
      typeName
    );
  const unionImplementations = apolloServerManager.getUnionImplementations(
    apolloServerManager.schema as GraphQLSchema,
    typeName
  );
  const queryAst = parse(query);
  let node: ASTNode = queryAst.definitions.find((definition) => {
    return (
      definition.kind === Kind.OPERATION_DEFINITION &&
      definition.name?.value === operationName
    );
  }) as OperationDefinitionNode;

  const nodesToVisit: {
    _node: ASTNode;
    currentKeys: string[];
  }[] = [
    {
      _node: node,
      currentKeys: [...keys],
    },
  ];

  const nodesFound: (FieldNode | InlineFragmentNode | FragmentSpreadNode)[] =
    [];

  while (nodesToVisit.length) {
    let {_node} = nodesToVisit[0];
    const {currentKeys} = nodesToVisit[0];
    const key = currentKeys[0];

    if (_node && 'selectionSet' in _node) {
      for (const selection of _node.selectionSet?.selections || []) {
        if (keyMatchesFieldNode(selection, key)) {
          if (
            currentKeys.length > 1 &&
            (selection as FieldNode).selectionSet?.selections.length
          ) {
            nodesToVisit.push({
              _node: selection,
              currentKeys: currentKeys.slice(1),
            });
          } else if (currentKeys.length === 1) {
            _node = selection;
            nodesFound.push(_node);
          }
        } else if (selection.kind === Kind.INLINE_FRAGMENT) {
          for (const inlineFragmentSelection of selection.selectionSet
            .selections) {
            if (keyMatchesFieldNode(inlineFragmentSelection, key)) {
              if (
                currentKeys.length > 1 &&
                (inlineFragmentSelection as FieldNode).selectionSet?.selections
                  .length
              ) {
                nodesToVisit.push({
                  _node: inlineFragmentSelection,
                  currentKeys: currentKeys.slice(1),
                });
              } else if (currentKeys.length === 1) {
                _node = inlineFragmentSelection;
                nodesFound.push(_node);
              }
            } else if (
              inlineFragmentSelection.kind !== Kind.FIELD &&
              'selectionSet' in inlineFragmentSelection
            ) {
              nodesToVisit.push({
                _node: inlineFragmentSelection,
                currentKeys,
              });
            }
          }
        }
      }
    }
    nodesToVisit.shift();

    if (nodesFound.length > 0) {
      node = nodesFound[0];

      for (let i = 1; i < nodesFound.length; i++) {
        // @ts-expect-error we don't care
        node.selectionSet.selections.push(
          // @ts-expect-error we don't care
          ...nodesFound[i].selectionSet.selections
        );
      }

      break;
    }
  }

  const fields: Array<FieldNode | InlineFragmentNode> = [];
  const subQueryNodesToVisit = [node];
  while (subQueryNodesToVisit.length) {
    const _node = subQueryNodesToVisit[0];
    if (_node && 'selectionSet' in _node) {
      _node.selectionSet?.selections.forEach((selection) => {
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
          } else if (
            selection.typeCondition &&
            (unionImplementations.includes(
              selection.typeCondition.name.value
            ) ||
              interfaceImplementations.includes(
                selection.typeCondition.name.value
              ))
          ) {
            subQueryNodesToVisit.push(selection);
          }
        }
      });
    }

    subQueryNodesToVisit.shift();
  }

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

  return apolloServerManager.addTypenameFieldsToQuery(
    print(newQueryAst as ASTNode)
  );
}
