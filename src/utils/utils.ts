import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import ts, { type SourceFile } from "typescript";
import type {
  TSPropertySignature,
  Parameter,
  TypeElement,
  TSTypeLiteral,
  TSTypeReference,
  TSTypeAnnotation,
  ArrowFunctionExpression,
  FunctionExpression,
  FunctionDeclaration,
} from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type { MyRuleContext, Options } from "../rules/enforce-route-params";

const ALLOWED_PROPS_FOR_ROUTECOMPONENT = [
  "params" as const,
  "searchParams" as const,
] as const;

/**
 *
 * @param filename the filename containing the folders
 * @returns true if the filename is one of Next.js' app router files that accecpt paramaters ({@link https://nextjs.org/docs/app/api-reference/file-conventions})
 */
export function isAppRouterFile(filename: string) {
  return filename.endsWith("page.tsx") || filename.endsWith("layout.tsx");
}

/**
 *
 * @param fileName the filename containing the folders, the separator must be "/"
 * @returns true if a folder named "app" is found
 */
export function appRouterFolderExists<TString extends string>(
  fileName: TString,
): TString extends `app/${string}` | `${string}/app/${string}`
  ? true
  : boolean {
  return (fileName.startsWith("app/") ||
    fileName.split("/").includes("app")) as TString extends
    | `app/${string}`
    | `${string}/app/${string}`
    ? true
    : boolean;
}

/**
 *
 *
 * @param fileName the filename containing the folders, the separator must be "/"
 * @returns a list of the dynamic parameters and if if they are catch all parameters
 */
export function readFileBasedParameters(
  fileName: string,
): { catchAll: boolean; name: string; current: boolean }[] {
  const folders = fileName.split("/");

  const appPosition = folders.findIndex((folder) => folder === "app");
  if (appPosition === -1) {
    return [];
  }
  const foldersWithoutFileName = folders.slice(appPosition, folders.length - 1);
  const result = foldersWithoutFileName
    .filter((folder) => folder.startsWith("[") && folder.endsWith("]"))
    .map((folder) => {
      const catchAll = folder.startsWith("[...");
      const name = folder.slice(catchAll ? 4 : 1, -1);
      return { catchAll, name, current: false };
    });

  const lastFolderName =
    foldersWithoutFileName[foldersWithoutFileName.length - 1];
  if (lastFolderName?.endsWith("]")) {
    result[result.length - 1]!.current = true;
  }

  return result;
}

export function handleFunctionParameters({
  props,
  context,
  options,
  fileBasedParameters,
}: {
  props: Parameter;
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>;
  options: Readonly<Options>;
  context: MyRuleContext;
}) {
  // no type annotation => could mean that is not using noImplicitAny
  if (!props || !("typeAnnotation" in props)) {
    return;
  }
  const innerTypeAnnotation = props.typeAnnotation?.typeAnnotation;

  switch (innerTypeAnnotation?.type) {
    case AST_NODE_TYPES.TSTypeLiteral:
      validateFirstParameter(
        innerTypeAnnotation,
        context,
        options,
        fileBasedParameters,
      );
      break;
    case AST_NODE_TYPES.TSTypeReference:
      const referencedTSTypeLiteral = findReferencedType(
        innerTypeAnnotation,
        context,
      );
      if (referencedTSTypeLiteral != null) {
        validateFirstParameter(
          referencedTSTypeLiteral,
          context,
          options,
          fileBasedParameters,
        );
      }
  }
}

function createCorrectParamsType(slugs: { catchAll: boolean; name: string }[]) {
  if (slugs.length === 0) {
    return `: ${getStringRepresentation(
      ts.factory.createTypeReferenceNode(
        ts.factory.createIdentifier("Record"),
        [
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword),
        ],
      ),
    )}`;
  }
  return `: { ${slugs
    .map((key) => `${key.name}: ${key.catchAll ? "string[]" : "string"}`)
    .join(", ")} }`;
}

export const correctSearchParamsTypeAnnotation = ` : ${getStringRepresentation(
  ts.factory.createTypeLiteralNode([
    ts.factory.createIndexSignature(
      undefined,
      [
        ts.factory.createParameterDeclaration(
          undefined,
          undefined,
          ts.factory.createIdentifier("key"),
          undefined,
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ),
      ],
      ts.factory.createUnionTypeNode([
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ts.factory.createArrayTypeNode(
          ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ),
        ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword),
      ]),
    ),
  ]),
)}` as const;

function getTypeOfMember(member: TypeElement): "string" | "string[]" | "other" {
  if (
    "typeAnnotation" in member &&
    member.typeAnnotation?.typeAnnotation.type ===
      AST_NODE_TYPES.TSStringKeyword
  )
    return "string";
  else if (
    "typeAnnotation" in member &&
    member.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSArrayType &&
    member.typeAnnotation.typeAnnotation.elementType.type ===
      AST_NODE_TYPES.TSStringKeyword
  ) {
    return "string[]";
  } else if (
    "typeAnnotation" in member &&
    member.typeAnnotation?.typeAnnotation.type ===
      AST_NODE_TYPES.TSTypeReference &&
    member.typeAnnotation.typeAnnotation.typeName.type ===
      AST_NODE_TYPES.Identifier &&
    member.typeAnnotation.typeAnnotation.typeName.name === "Array" &&
    member.typeAnnotation.typeAnnotation.typeArguments &&
    member.typeAnnotation.typeAnnotation.typeArguments.params.length === 1 &&
    member.typeAnnotation.typeAnnotation.typeArguments.params[0]?.type ===
      AST_NODE_TYPES.TSStringKeyword
  ) {
    return "string[]";
  } else return "other";
}

function reportWrongParameterIssue(
  context: MyRuleContext,
  paramsTypeNode: TypeElement | TSTypeLiteral,
  wrongTypeRange: [number, number] | null,
  data: { name: string | null; type: "string" | "string[]" },
) {
  context.report({
    loc: paramsTypeNode.loc,
    messageId: "issue:isWrongParameterType",
    data,
    fix: (fixer) => fixer.replaceTextRange(wrongTypeRange!, data.type),
  });
}

function validateFirstParameter(
  paramsType: TSTypeLiteral,
  context: MyRuleContext,
  options: Readonly<Options>,
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>,
) {
  paramsType.members
    .filter(
      (member): member is TSPropertySignature & { key: { name: string } } =>
        member.type === AST_NODE_TYPES.TSPropertySignature &&
        member.key.type === AST_NODE_TYPES.Identifier &&
        !ALLOWED_PROPS_FOR_ROUTECOMPONENT.includes(
          member.key.name as (typeof ALLOWED_PROPS_FOR_ROUTECOMPONENT)[number],
        ),
    )
    .forEach((member) => {
      const typeAnnotationRange =
        member.typeAnnotation?.range[1] ?? member.key.range[1];
      context.report({
        loc: member.loc,
        messageId: "issue:forbiddenPropertyKey",
        data: { key: member.key.name },
        fix: (fixer) =>
          fixer.removeRange([member.key.range[0], typeAnnotationRange]),
      });
    });

  if (options[0].searchParams) {
    validateSearchParamsMember(paramsType, context);
  }
  validateParamsMember(paramsType, context, fileBasedParameters);
}

function findReferencedType(
  typeReference: TSTypeReference,
  context: MyRuleContext,
) {
  if (typeReference.typeName.type !== AST_NODE_TYPES.Identifier) {
    context.report({
      loc: typeReference.loc,
      messageId: "issue:isNoLiteral",
    });
    return null;
  }
  const nameOfReferencedType = typeReference.typeName.name;
  const node = context.sourceCode.scopeManager?.variables?.find(
    (variable) =>
      variable.name === nameOfReferencedType && variable.isTypeVariable,
  )?.defs[0]?.node;
  if (
    node?.type !== AST_NODE_TYPES.TSTypeAliasDeclaration ||
    node.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral
  ) {
    context.report({
      loc: typeReference.loc,
      messageId: "issue:isNoLiteral",
    });
    return null;
  }
  return node.typeAnnotation;
}

function validateParamsMember(
  paramsType: TSTypeLiteral,
  context: MyRuleContext,
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>,
) {
  const paramsMember = paramsType.members.find(
    (member) =>
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      member.key.type === AST_NODE_TYPES.Identifier &&
      member.key.name === ALLOWED_PROPS_FOR_ROUTECOMPONENT[0],
  );

  if (
    !paramsMember ||
    !("typeAnnotation" in paramsMember) ||
    !paramsMember.typeAnnotation
  ) {
    return;
  }

  if (
    paramsMember.typeAnnotation.typeAnnotation.type ===
      AST_NODE_TYPES.TSTypeReference &&
    paramsMember.typeAnnotation.typeAnnotation.typeName.type ===
      AST_NODE_TYPES.Identifier
  ) {
    return;
  }

  const isExplicitlyTypedType =
    paramsMember.type === AST_NODE_TYPES.TSPropertySignature &&
    paramsMember.typeAnnotation.typeAnnotation.type ===
      AST_NODE_TYPES.TSTypeLiteral;
  if (!isExplicitlyTypedType) {
    // report an problem here definitely => must be a TSPropertySignature type
    context.report({
      loc: paramsMember.loc,
      messageId: "issue:isNoLiteral",
    });
    return;
  }

  if (
    !paramsMember.typeAnnotation.typeAnnotation ||
    !("members" in paramsMember.typeAnnotation.typeAnnotation)
  ) {
    return;
  }

  const params: {
    range: [number, number] | null;
    isLiteral: boolean;
    name: string | null;
    type: "string" | "string[]" | "other";
  }[] = paramsMember.typeAnnotation.typeAnnotation.members.map((member) => ({
    range:
      "typeAnnotation" in member
        ? (member.typeAnnotation?.typeAnnotation.range ?? null)
        : null,
    isLiteral:
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      member.key.type === AST_NODE_TYPES.Identifier,
    type: getTypeOfMember(member),
    name: "key" in member && "name" in member.key ? member.key.name : null,
  }));

  const actualParamNames = fileBasedParameters.map((param) => param.name);
  const unAllowedParams = params.filter(
    (param) => param.name == null || !actualParamNames.includes(param.name),
  );
  if (unAllowedParams.length > 0) {
    context.report({
      loc: paramsMember.typeAnnotation.loc,
      messageId: "issue:unknown-parameter",
      data: { name: unAllowedParams[0]!.name },
      fix: (fixer) =>
        fixer.replaceTextRange(
          paramsMember.typeAnnotation!.range,
          createCorrectParamsType(fileBasedParameters),
        ),
    });
  }
  const routeParams = fileBasedParameters
    .filter((param) => !param.catchAll)
    .map((param) => param.name);

  const catchAllParams = fileBasedParameters
    .filter((param) => param.catchAll)
    .map((param) => param.name);

  const mustBeString = params.find((param) =>
    routeParams.find((p) => param.name === p && param.type !== "string"),
  );
  if (mustBeString) {
    reportWrongParameterIssue(context, paramsMember, mustBeString.range, {
      name: mustBeString.name,
      type: "string",
    });
  }

  const mustBeStringArray = params.find((param) =>
    catchAllParams.find((p) => param.name === p && param.type !== "string[]"),
  );

  if (mustBeStringArray) {
    reportWrongParameterIssue(context, paramsMember, mustBeStringArray.range, {
      name: mustBeStringArray.name,
      type: "string[]",
    });
  }

  const areNotAllLiteral = params.filter((param) => param.isLiteral === false);
  if (areNotAllLiteral.length > 0) {
    context.report({
      loc: paramsMember.loc,
      messageId: "issue:isNoLiteral",
    });
  }
  return { functionTypes: [], paramTypes: [] };
}

function validateSearchParamsMember(
  paramsType: TSTypeLiteral,
  context: MyRuleContext,
) {
  const searchParamsMember = paramsType.members.find(
    (member) =>
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      member.key.type === AST_NODE_TYPES.Identifier &&
      member.key.name === ALLOWED_PROPS_FOR_ROUTECOMPONENT[1],
  );
  if (
    !searchParamsMember ||
    !("typeAnnotation" in searchParamsMember) ||
    !searchParamsMember.typeAnnotation
  ) {
    return;
  }
  function reportWrongSearchParamsTypeIssue(node: TSTypeAnnotation) {
    context.report({
      loc: searchParamsMember!.loc,
      messageId: "issue:wrong-searchParams-type",
      fix: (fixer) =>
        fixer.replaceTextRange(node.range, correctSearchParamsTypeAnnotation),
    });
  }

  if (
    searchParamsMember.typeAnnotation.typeAnnotation.type !==
    AST_NODE_TYPES.TSTypeLiteral
  ) {
    reportWrongSearchParamsTypeIssue(searchParamsMember.typeAnnotation);
    return;
  }

  const members = searchParamsMember.typeAnnotation.typeAnnotation.members;
  if (members.length !== 1) {
    reportWrongSearchParamsTypeIssue(searchParamsMember.typeAnnotation);
    return;
  }
  const member = members[0]!;
  if (
    member.type !== AST_NODE_TYPES.TSIndexSignature ||
    member.typeAnnotation?.type !== AST_NODE_TYPES.TSTypeAnnotation ||
    member.typeAnnotation.typeAnnotation.type !== AST_NODE_TYPES.TSUnionType
  ) {
    reportWrongSearchParamsTypeIssue(searchParamsMember.typeAnnotation);
    return;
  }
  const unionType = member.typeAnnotation.typeAnnotation;
  const areAllowedSearchParamsTypes = unionType.types.reduce(
    (acc, element) => {
      if (acc == undefined) {
        return acc;
      }
      if (element.type === AST_NODE_TYPES.TSStringKeyword) {
        acc.str = true;
        return acc;
      } else if (
        (element.type === AST_NODE_TYPES.TSArrayType &&
          element.elementType.type === AST_NODE_TYPES.TSStringKeyword) ||
        (element.type === AST_NODE_TYPES.TSTypeReference &&
          element.typeName.type === AST_NODE_TYPES.Identifier &&
          element.typeName.name === "Array" &&
          element.typeArguments?.params.length === 1 &&
          element.typeArguments.params[0]?.type ===
            AST_NODE_TYPES.TSStringKeyword)
      ) {
        acc.strArr = true;
        return acc;
      } else if (element.type === AST_NODE_TYPES.TSUndefinedKeyword) {
        acc.undef = true;
        return acc;
      } else {
        return undefined;
      }
    },
    { str: false, strArr: false, undef: false } as
      | { str: boolean; strArr: boolean; undef: boolean }
      | undefined,
  );

  if (
    !areAllowedSearchParamsTypes ||
    Object.values(areAllowedSearchParamsTypes).includes(false)
  ) {
    reportWrongSearchParamsTypeIssue(searchParamsMember.typeAnnotation);
  }
}

const createTSTypeForGenerateStaticParams = (
  async: boolean,
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>,
) => {
  const fileBasedReturnType = ts.factory.createArrayTypeNode(
    createInnerTSTypeForGenerateStaticParams(fileBasedParameters),
  );
  if (async) {
    return ts.factory.createTypeReferenceNode(
      ts.factory.createIdentifier("Promise"),
      [fileBasedReturnType],
    );
  }
  return fileBasedReturnType;
};

const createTSTypeForGenerateStaticParamsAsString = (
  async: boolean,
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>,
) =>
  `${getStringRepresentation(
    createTSTypeForGenerateStaticParams(async, fileBasedParameters),
  )} `;

export const createInnerTSTypeForGenerateStaticParams = (
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>,
) =>
  ts.factory.createTypeLiteralNode(
    fileBasedParameters.map((param) =>
      ts.factory.createPropertySignature(
        undefined,
        ts.factory.createIdentifier(param.name),
        !param.current
          ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
          : undefined,
        !param.catchAll
          ? ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
          : ts.factory.createArrayTypeNode(
              ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            ),
      ),
    ),
  );

export function getStringRepresentation(typeNode: ts.TypeNode): string {
  return ts
    .createPrinter()
    .printNode(
      ts.EmitHint.Unspecified,
      typeNode,
      undefined as unknown as SourceFile,
    );
}

export function handleGenerateStaticParamsFunction(
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>,
  functionNode:
    | ArrowFunctionExpression
    | FunctionExpression
    | FunctionDeclaration,
  context: MyRuleContext,
) {
  const returnType = functionNode.returnType;
  //check if the return type is Promise<T>

  if (returnType == null) {
    const arrowToken = context.sourceCode.getFirstToken(
      functionNode,
      (token) => token.value === "=>",
    );
    if (
      functionNode.type === AST_NODE_TYPES.ArrowFunctionExpression &&
      arrowToken != null
    ) {
      context.report({
        loc: functionNode.loc,
        messageId: "issue:no-returntype",
        fix: (fixer) =>
          fixer.insertTextBeforeRange(
            arrowToken.range,
            `: ${createTSTypeForGenerateStaticParamsAsString(
              functionNode.async,
              fileBasedParameters,
            )}`,
          ),
      });
    } else {
      context.report({
        loc: functionNode.loc,
        messageId: "issue:no-returntype",
        fix: (fixer) =>
          fixer.insertTextBeforeRange(
            functionNode.body.range,
            `: ${createTSTypeForGenerateStaticParamsAsString(
              functionNode.async,
              fileBasedParameters,
            )}`,
          ),
      });
    }
    return;
  }

  if (!("typeAnnotation" in returnType)) {
    return;
  }
  const fullTypeAnnotation = returnType.typeAnnotation;

  // take the T of Promise<T> if it is a Promise
  const typeAnnotation =
    fullTypeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
    fullTypeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
    fullTypeAnnotation.typeName.name === "Promise" &&
    fullTypeAnnotation.typeArguments?.params[0]
      ? fullTypeAnnotation.typeArguments.params[0]
      : fullTypeAnnotation;

  const isArray = typeAnnotation.type === AST_NODE_TYPES.TSArrayType;

  if (!isArray) {
    context.report({
      loc: functionNode.loc,
      messageId: "issue:wrong-returntype",
      fix: (fixer) =>
        fixer.replaceTextRange(
          returnType.range,
          `: ${createTSTypeForGenerateStaticParamsAsString(
            functionNode.async,
            fileBasedParameters,
          )}`,
        ),
    });
    return;
  }

  const arrayType = typeAnnotation.elementType;
  const arrayTypeAnnotation = arrayType.type;
  switch (arrayTypeAnnotation) {
    case AST_NODE_TYPES.TSTypeLiteral:
      handleGenerateStaticParamsInnerReturnTypeOfArray(
        arrayType,
        context,
        fileBasedParameters,
      );
      return;
    case AST_NODE_TYPES.TSTypeReference: {
      const type = findReferencedType(arrayType, context);
      if (type) {
        handleGenerateStaticParamsInnerReturnTypeOfArray(
          type,
          context,
          fileBasedParameters,
        );
        return;
      } else {
        context.report({
          loc: functionNode.loc,
          messageId: "issue:isNoLiteral",
          fix: (fixer) =>
            fixer.replaceTextRange(
              returnType.range,
              createTSTypeForGenerateStaticParamsAsString(
                functionNode.async,
                fileBasedParameters,
              ),
            ),
        });
        return;
      }
    }
    default: {
      context.report({
        loc: functionNode.loc,
        messageId: "issue:isNoLiteral",
        fix: (fixer) =>
          fixer.replaceTextRange(
            returnType.range,
            createTSTypeForGenerateStaticParamsAsString(
              functionNode.async,
              fileBasedParameters,
            ),
          ),
      });
      return;
    }
  }
}
const handleGenerateStaticParamsInnerReturnTypeOfArray = (
  paramsMember: TSTypeLiteral,
  context: MyRuleContext,
  fileBasedParameters: ReturnType<typeof readFileBasedParameters>,
) => {
  const params: {
    range: [number, number] | null;
    isLiteral: boolean;
    name: string | null;
    type: "string" | "string[]" | "other";
    optional: boolean;
  }[] = paramsMember.members.map((member) => ({
    range:
      "typeAnnotation" in member
        ? (member.typeAnnotation?.typeAnnotation.range ?? null)
        : null,
    isLiteral:
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      member.key.type === AST_NODE_TYPES.Identifier,
    type: getTypeOfMember(member),
    name: "key" in member && "name" in member.key ? member.key.name : null,
    optional: "optional" in member && member.optional,
  }));

  const actualParamNames = fileBasedParameters.map((param) => param.name);
  const unAllowedParams = params.filter(
    (param) => param.name == null || !actualParamNames.includes(param.name),
  );
  if (unAllowedParams.length > 0) {
    context.report({
      loc: paramsMember.loc,
      messageId: "issue:unknown-parameter",
      data: { name: unAllowedParams[0]!.name },
      fix: (fixer) =>
        fixer.replaceTextRange(
          paramsMember.range,
          getStringRepresentation(
            createInnerTSTypeForGenerateStaticParams(fileBasedParameters),
          ),
        ),
    });
    return;
  }
  const routeParams = fileBasedParameters
    .filter((param) => !param.catchAll)
    .map((param) => param.name);

  const catchAllParams = fileBasedParameters
    .filter((param) => param.catchAll)
    .map((param) => param.name);

  const mustBeString = params.find((param) =>
    routeParams.find((p) => param.name === p && param.type !== "string"),
  );
  if (mustBeString) {
    reportWrongParameterIssue(context, paramsMember, mustBeString.range, {
      name: mustBeString.name,
      type: "string",
    });
    return;
  }

  const mustBeStringArray = params.find((param) =>
    catchAllParams.find((p) => param.name === p && param.type !== "string[]"),
  );

  if (mustBeStringArray) {
    reportWrongParameterIssue(context, paramsMember, mustBeStringArray.range, {
      name: mustBeStringArray.name,
      type: "string[]",
    });
    return;
  }

  const areNotAllLiteral = params.filter((param) => param.isLiteral === false);
  if (areNotAllLiteral.length > 0) {
    context.report({
      loc: paramsMember.loc,
      messageId: "issue:isNoLiteral",
    });
    return;
  }

  const requiredByFileName = fileBasedParameters.find((param) => param.current);
  if (requiredByFileName != null) {
    const typeInUhmParams = params.find(
      (param) => param.name === requiredByFileName.name,
    );
    if (typeInUhmParams == null || typeInUhmParams.optional) {
      context.report({
        loc: paramsMember.loc,
        messageId: "issue:isNoOptionalParam",
        data: { name: requiredByFileName.name },
        fix: (fixer) =>
          fixer.replaceTextRange(
            paramsMember.range,
            getStringRepresentation(
              createInnerTSTypeForGenerateStaticParams(fileBasedParameters),
            ),
          ),
      });
      return;
    }
  }

  return { functionTypes: [], paramTypes: [] };
};
