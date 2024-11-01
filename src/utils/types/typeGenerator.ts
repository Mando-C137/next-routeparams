import ts from "typescript";
import type { FilebasedParams, getFileInfo } from "../fs";

function wrapTypeWithIdentifier({
  type,
  identifier,
}: {
  type: ts.TypeNode;
  identifier: string;
}) {
  return ts.factory.createTypeReferenceNode(
    ts.factory.createIdentifier(identifier),
    [type],
  );
}

function wrapTypeWithPromise({ type }: { type: ts.TypeNode }) {
  return wrapTypeWithIdentifier({ type, identifier: "Promise" });
}

function wrapTypeWithArray({ type }: { type: ts.TypeNode }) {
  return ts.factory.createArrayTypeNode(type);
}
function makeUnionType(...types: ts.TypeNode[]) {
  return ts.factory.createUnionTypeNode(types);
}
function makeRecordType(from: ts.TypeNode, to: ts.TypeNode) {
  return ts.factory.createTypeReferenceNode(
    ts.factory.createIdentifier("Record"),
    [from, to],
  );
}

const STRING_TYPE_NODE = ts.factory.createKeywordTypeNode(
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
const SEARCHPARAMS_TYPE_NODE = (
  asyncRequestAPI: GeneratorParams["asyncRequestAPI"],
) => {
  const searchParamsType = ts.factory.createTypeLiteralNode([
    ts.factory.createIndexSignature(
      undefined,
      [SEARCHPARAMS_KEY_TYPE_NODE],
      SEARCHPARAMS_VALUE_TYPE_NODE,
    ),
  ]);
  if (!asyncRequestAPI) {
    return searchParamsType;
  }
  return wrapTypeWithPromise({ type: searchParamsType });
};

/**
 * will equal to ```Record<string, never>```
 */
const createEmptyParamsTypeNode = ({ asyncRequestAPI }: GeneratorParams) => {
  const recordType = makeRecordType(
    STRING_TYPE_NODE,
    ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
  );
  if (asyncRequestAPI) {
    return wrapTypeWithPromise({ type: recordType });
  }
  return recordType;
};

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
 */
function createParamsTypeNode({ asyncRequestAPI, params }: GeneratorParams) {
  const paramsType = ts.factory.createTypeLiteralNode(
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
  if (!asyncRequestAPI) {
    return paramsType;
  }
  return wrapTypeWithPromise({ type: paramsType });
}

const createGenerateStaticParamsReturntypeArrayArgument = (
  params: FilebasedParams,
) =>
  ts.factory.createTypeLiteralNode(
    params.map((param) =>
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(param.name),
        !param.current
          ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
          : undefined,
        !param.catchAll
          ? STRING_TYPE_NODE
          : ts.factory.createArrayTypeNode(STRING_TYPE_NODE),
      ),
    ),
  );

const createGenerateStaticParamsReturntype = (
  async: boolean,
  params: FilebasedParams,
) => {
  const type = wrapTypeWithArray({
    type: createGenerateStaticParamsReturntypeArrayArgument(params),
  });
  if (async) {
    return wrapTypeWithPromise({ type });
  }
  return type;
};

function stringify(typeNode: ts.TypeNode): string;
function stringify<TParams extends unknown[]>(
  typeNodeFactory: (...params: TParams) => ts.TypeNode,
): (...params: TParams) => string;
function stringify<TParams extends unknown[]>(
  typeNodeOrFactory: ts.TypeNode | ((...params: TParams) => ts.TypeNode),
): string | ((...params: TParams) => string) {
  const stringifier = (typeNode: ts.TypeNode): string =>
    ts
      .createPrinter()
      .printNode(
        ts.EmitHint.Unspecified,
        typeNode,
        undefined as unknown as ts.SourceFile,
      );

  if (typeof typeNodeOrFactory === "function") {
    return (...params: TParams): string =>
      stringifier(
        (typeNodeOrFactory as (...args: TParams) => ts.TypeNode)(...params),
      );
  }
  return stringifier(typeNodeOrFactory);
}

/***************** STRINGIFIED  TYPES******************/

export const SEARCHPARAMS_TYPE_NODE_STRING = stringify(SEARCHPARAMS_TYPE_NODE);

const creatEmptyParamsTypeNodeString = stringify(createEmptyParamsTypeNode);

export function createParamsTypeNodeString(generatorParams: GeneratorParams) {
  return generatorParams.params.length === 0
    ? creatEmptyParamsTypeNodeString(generatorParams)
    : stringify(createParamsTypeNode)(generatorParams);
}

type GeneratorParams = Pick<
  ReturnType<typeof getFileInfo>,
  "params" | "asyncRequestAPI"
>;

export const createGenerateStaticParamsReturntypeArrayArgumentString =
  stringify(createGenerateStaticParamsReturntypeArrayArgument);

export const createGenerateStaticParamsReturntypeString = (
  async: boolean,
  params: FilebasedParams,
) => `${stringify(createGenerateStaticParamsReturntype(async, params))} `;
