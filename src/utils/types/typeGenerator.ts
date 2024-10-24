import type { FilebasedParams } from "src/rules/enforce-route-params";
import ts, { type SourceFile, type TypeNode } from "typescript";

function wrapTypeWithIdentifier({
  type,
  identifier,
}: {
  type: TypeNode;
  identifier: string;
}) {
  return ts.factory.createTypeReferenceNode(
    ts.factory.createIdentifier(identifier),
    [type],
  );
}

export function wrapTypeWithPromise({ type }: { type: TypeNode }) {
  return wrapTypeWithIdentifier({ type, identifier: "Promise" });
}

export function wrapTypeWithArray({ type }: { type: TypeNode }) {
  return ts.factory.createArrayTypeNode(type);
}
export function makeUnionType(...types: TypeNode[]) {
  return ts.factory.createUnionTypeNode(types);
}
export function makeRecordType(from: TypeNode, to: TypeNode) {
  return ts.factory.createTypeReferenceNode(
    ts.factory.createIdentifier("Record"),
    [from, to],
  );
}

export const STRING_TYPE_NODE = ts.factory.createKeywordTypeNode(
  ts.SyntaxKind.StringKeyword,
);

/**
 * will equal to ```[key: string]```
 */
const SEARCHPARAMS_KEY_TYPE_NODE = ts.factory.createParameterDeclaration(
  undefined,
  undefined,
  ts.factory.createIdentifier("key"),
  undefined,
  STRING_TYPE_NODE,
);

/**
 * will equal to ```string | string[] | undefined```
 */
const SEARCHPARAMS_VALUE_TYPE_NODE = makeUnionType(
  STRING_TYPE_NODE,
  wrapTypeWithArray({ type: STRING_TYPE_NODE }),
  ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
);

/**
 * will equal to ```[key :string]: string | string[] | undefined```
 */
const SEARCHPARAMS_TYPE_NODE = ts.factory.createTypeLiteralNode([
  ts.factory.createIndexSignature(
    undefined,
    [SEARCHPARAMS_KEY_TYPE_NODE],
    SEARCHPARAMS_VALUE_TYPE_NODE,
  ),
]);

/**
 * will equal to ```Record<string, never>```
 */
const EMPTY_PARAMS_TYPE_NODE = makeRecordType(
  STRING_TYPE_NODE,
  ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
);

/**
 * will equal to an object literal
 *
 * ```[ {name: "postId", catchAll: false } , { name: "userId", catchAll: true }]``` will equal to
 * ```
 * { postId: string,
 *   userId: string[]
 * }
 * ```
 *
 * @param params
 * @returns
 */
function createParamsTypeNode(params: FilebasedParams) {
  return ts.factory.createTypeLiteralNode(
    params.map((param) =>
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(param.name),
        undefined,
        !param.catchAll
          ? STRING_TYPE_NODE
          : ts.factory.createArrayTypeNode(STRING_TYPE_NODE),
      ),
    ),
  );
}

export const stringifyTypeNode = (typeNode: ts.TypeNode): string =>
  ts
    .createPrinter()
    .printNode(
      ts.EmitHint.Unspecified,
      typeNode,
      undefined as unknown as SourceFile,
    );

/***************** STRINGIFIED  TYPES******************/

export const SEARCHPARAMS_TYPE_NODE_STRING = stringifyTypeNode(
  SEARCHPARAMS_TYPE_NODE,
);

const EMPTY_PARAMS_TYPE_NODE_STRING = stringifyTypeNode(EMPTY_PARAMS_TYPE_NODE);

export function createParamsTypeNodeString(params: FilebasedParams) {
  return stringifyTypeNode(createParamsTypeNode(params));
}

export function createParamsTypeNodeStringWithColon(params: FilebasedParams) {
  return `: ${params.length === 0 ? EMPTY_PARAMS_TYPE_NODE_STRING : createParamsTypeNodeString(params)}`;
}
