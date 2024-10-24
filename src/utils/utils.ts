import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import ts from "typescript";
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
import type {
  Context,
  CustomContext,
  FilebasedParams,
  MyRuleContext,
  Options,
} from "../rules/enforce-route-params";
import path, { posix } from "path";
import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import {
  createParamsTypeNodeStringWithColon,
  SEARCHPARAMS_TYPE_NODE_STRING,
  STRING_TYPE_NODE,
  stringifyTypeNode,
  wrapTypeWithArray,
  wrapTypeWithPromise,
} from "./types/typeGenerator";

const PARAMS_PROP_NAME = "params";
const SEARCHPARAMS_PROP_NAME = "searchParams";
const CHILDREN_PROP_NAME = "children";

const ALLOWED_PROPS_FOR_PAGE = [
  PARAMS_PROP_NAME,
  SEARCHPARAMS_PROP_NAME,
] as const;

const ALLOWED_PROPS_FOR_LAYOUT = [
  PARAMS_PROP_NAME,
  CHILDREN_PROP_NAME,
] as const;

/**
 *
 * @param filename the filename containing the folders
 * @returns true if the filename is one of Next.js' app router files that accecpt paramaters ({@link https://nextjs.org/docs/app/api-reference/file-conventions})
 */
export function isAppRouterFile(filename: string) {
  return (
    path.basename(filename) === "page.tsx" ||
    path.basename(filename) === "layout.tsx"
  );
}
export function getFilenameType(
  filename: string,
): "page" | "layout" | "template" | null {
  switch (path.parse(filename).name) {
    case "page":
      return "page";
    case "layout":
      return "layout";
    case "template":
      return "template";
    default:
      return null;
  }
}
type FileNameType = ReturnType<typeof getFilenameType>;

function getAllowedPropsForFilenameType(fileType: FileNameType): Array<string> {
  switch (fileType) {
    case "page":
      return [...ALLOWED_PROPS_FOR_PAGE];
    case "layout":
      return [...ALLOWED_PROPS_FOR_LAYOUT];
    case "template":
      return [...ALLOWED_PROPS_FOR_PAGE];
    case null:
      throw new Error("File type is not defined");
  }
}

/**
 *
 * @param dirname the dirname containing the folders, the separator must be "/"
 * @returns true if a folder named "app" is found
 */
export function appRouterFolderExists(dirname: string): boolean {
  return dirname.split(posix.sep).includes("app");
}

/**
 *
 *
 * @param dirname the dirname containing the folders, the separator must be "/"
 * @returns a list of the dynamic parameters and if if they are catch all parameters
 */
export function readFileBasedParameters(
  dirname: string,
): { catchAll: boolean; name: string; current: boolean }[] {
  const folders = dirname.split(posix.sep);

  const appPosition = folders.findIndex((folder) => folder === "app");
  if (appPosition === -1) {
    return [];
  }
  const result = folders
    .filter((folder) => folder.startsWith("[") && folder.endsWith("]"))
    .map((folder) => {
      const catchAll = folder.startsWith("[...");
      const name = folder.slice(catchAll ? 4 : 1, -1);
      return { catchAll, name, current: false };
    });

  const lastFolderName = folders[folders.length - 1];
  if (lastFolderName?.endsWith("]")) {
    result[result.length - 1]!.current = true;
  }

  return result;
}

export function handleFunctionParameters({
  props,
  context,
  options,
}: {
  props: Parameter;
  options: Readonly<Options>;
  context: Context;
}) {
  // no type annotation => could mean that is not using noImplicitAny
  if (!props || !("typeAnnotation" in props)) {
    return;
  }
  const innerTypeAnnotation = props.typeAnnotation?.typeAnnotation;

  switch (innerTypeAnnotation?.type) {
    case AST_NODE_TYPES.TSTypeLiteral:
      validateFirstParameter(innerTypeAnnotation, context, options);
      break;
    case AST_NODE_TYPES.TSTypeReference:
      const referencedTSTypeLiteral = findReferencedType(
        innerTypeAnnotation,
        context,
      );
      if (referencedTSTypeLiteral != null) {
        validateFirstParameter(referencedTSTypeLiteral, context, options);
      }
  }
}

export const correctSearchParamsTypeAnnotation = ` : ${
  SEARCHPARAMS_TYPE_NODE_STRING
}
` as const;

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
  context: Context,
  paramsTypeNode: TypeElement | TSTypeLiteral,
  wrongTypeRange: [number, number] | null,
  data: { name: string | null; type: "string" | "string[]" },
) {
  context.ruleContext.report({
    loc: paramsTypeNode.loc,
    messageId: "issue:isWrongParameterType",
    data,
    fix: (fixer) => fixer.replaceTextRange(wrongTypeRange!, data.type),
  });
}

function validateFirstParameter(
  paramsType: TSTypeLiteral,
  context: Context,
  options: Readonly<Options>,
) {
  paramsType.members
    .filter(
      (member): member is TSPropertySignature & { key: { name: string } } =>
        member.type === AST_NODE_TYPES.TSPropertySignature &&
        member.key.type === AST_NODE_TYPES.Identifier &&
        !getAllowedPropsForFilenameType(
          context.customContext.fileType,
        ).includes(member.key.name),
    )
    .forEach((member) => {
      const typeAnnotationRange =
        member.typeAnnotation?.range[1] ?? member.key.range[1];
      context.ruleContext.report({
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
  validateParamsMember(paramsType, context);
}

function findReferencedType(
  typeReference: TSTypeReference,
  { ruleContext }: Context,
) {
  if (typeReference.typeName.type !== AST_NODE_TYPES.Identifier) {
    ruleContext.report({
      loc: typeReference.loc,
      messageId: "issue:isNoLiteral",
    });
    return null;
  }
  const nameOfReferencedType = typeReference.typeName.name;
  const node = ruleContext.sourceCode.scopeManager?.variables?.find(
    (variable) =>
      variable.name === nameOfReferencedType && variable.isTypeVariable,
  )?.defs[0]?.node;
  if (
    node?.type !== AST_NODE_TYPES.TSTypeAliasDeclaration ||
    node.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral
  ) {
    ruleContext.report({
      loc: typeReference.loc,
      messageId: "issue:isNoLiteral",
    });
    return null;
  }
  return node.typeAnnotation;
}

function validateParamsMember(paramsType: TSTypeLiteral, context: Context) {
  const paramsMember = paramsType.members.find(
    (member) =>
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      member.key.type === AST_NODE_TYPES.Identifier &&
      member.key.name === ALLOWED_PROPS_FOR_PAGE[0],
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
    context.ruleContext.report({
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

  const actualParamNames = context.customContext.fileBasedParameters.map(
    (param) => param.name,
  );
  const unAllowedParams = params.filter(
    (param) => param.name == null || !actualParamNames.includes(param.name),
  );
  if (unAllowedParams.length > 0) {
    context.ruleContext.report({
      loc: paramsMember.typeAnnotation.loc,
      messageId: "issue:unknown-parameter",
      data: { name: unAllowedParams[0]!.name },
      fix: (fixer) =>
        fixer.replaceTextRange(
          paramsMember.typeAnnotation!.range,
          createParamsTypeNodeStringWithColon(
            context.customContext.fileBasedParameters,
          ),
        ),
    });
  }
  const routeParams = context.customContext.fileBasedParameters
    .filter((param) => !param.catchAll)
    .map((param) => param.name);

  const catchAllParams = context.customContext.fileBasedParameters
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
    context.ruleContext.report({
      loc: paramsMember.loc,
      messageId: "issue:isNoLiteral",
    });
  }
  return { functionTypes: [], paramTypes: [] };
}

function validateSearchParamsMember(
  paramsType: TSTypeLiteral,
  { ruleContext }: Context,
) {
  const searchParamsMember = paramsType.members.find(
    (member) =>
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      member.key.type === AST_NODE_TYPES.Identifier &&
      member.key.name === SEARCHPARAMS_PROP_NAME,
  );
  if (
    !searchParamsMember ||
    !("typeAnnotation" in searchParamsMember) ||
    !searchParamsMember.typeAnnotation
  ) {
    return;
  }
  function reportWrongSearchParamsTypeIssue(node: TSTypeAnnotation) {
    ruleContext.report({
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
  fileBasedParameters: FilebasedParams,
) => {
  const fileBasedReturnType = wrapTypeWithArray({
    type: createInnerTSTypeForGenerateStaticParams(fileBasedParameters),
  });
  if (async) {
    return wrapTypeWithPromise({ type: fileBasedReturnType });
  }
  return fileBasedReturnType;
};

const createTSTypeForGenerateStaticParamsAsString = (
  async: boolean,
  fileBasedParameters: FilebasedParams,
) =>
  `${stringifyTypeNode(
    createTSTypeForGenerateStaticParams(async, fileBasedParameters),
  )} `;

export const createInnerTSTypeForGenerateStaticParams = (
  fileBasedParameters: FilebasedParams,
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
          ? STRING_TYPE_NODE
          : ts.factory.createArrayTypeNode(STRING_TYPE_NODE),
      ),
    ),
  );

export function handleGenerateStaticParamsFunction(
  functionNode:
    | ArrowFunctionExpression
    | FunctionExpression
    | FunctionDeclaration,
  context: { ruleContext: MyRuleContext; customContext: CustomContext },
) {
  const returnType = functionNode.returnType;
  //check if the return type is Promise<T>

  if (returnType == null) {
    const arrowToken = context.ruleContext.sourceCode.getFirstToken(
      functionNode,
      (token) => token.value === "=>",
    );
    if (
      functionNode.type === AST_NODE_TYPES.ArrowFunctionExpression &&
      arrowToken != null
    ) {
      context.ruleContext.report({
        loc: functionNode.loc,
        messageId: "issue:no-returntype",
        fix: (fixer) =>
          fixer.insertTextBeforeRange(
            arrowToken.range,
            `: ${createTSTypeForGenerateStaticParamsAsString(
              functionNode.async,
              context.customContext.fileBasedParameters,
            )}`,
          ),
      });
    } else {
      context.ruleContext.report({
        loc: functionNode.loc,
        messageId: "issue:no-returntype",
        fix: (fixer) =>
          fixer.insertTextBeforeRange(
            functionNode.body.range,
            `: ${createTSTypeForGenerateStaticParamsAsString(
              functionNode.async,
              context.customContext.fileBasedParameters,
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
    context.ruleContext.report({
      loc: functionNode.loc,
      messageId: "issue:wrong-returntype",
      fix: (fixer) =>
        fixer.replaceTextRange(
          returnType.range,
          `: ${createTSTypeForGenerateStaticParamsAsString(
            functionNode.async,
            context.customContext.fileBasedParameters,
          )}`,
        ),
    });
    return;
  }

  const arrayType = typeAnnotation.elementType;
  const arrayTypeAnnotation = arrayType.type;
  switch (arrayTypeAnnotation) {
    case AST_NODE_TYPES.TSTypeLiteral:
      handleGenerateStaticParamsInnerReturnTypeOfArray(arrayType, context);
      return;
    case AST_NODE_TYPES.TSTypeReference: {
      const type = findReferencedType(arrayType, context);
      if (type) {
        handleGenerateStaticParamsInnerReturnTypeOfArray(type, context);
        return;
      } else {
        context.ruleContext.report({
          loc: functionNode.loc,
          messageId: "issue:isNoLiteral",
          fix: (fixer) =>
            fixer.replaceTextRange(
              returnType.range,
              createTSTypeForGenerateStaticParamsAsString(
                functionNode.async,
                context.customContext.fileBasedParameters,
              ),
            ),
        });
        return;
      }
    }
    default: {
      context.ruleContext.report({
        loc: functionNode.loc,
        messageId: "issue:isNoLiteral",
        fix: (fixer) =>
          fixer.replaceTextRange(
            returnType.range,
            createTSTypeForGenerateStaticParamsAsString(
              functionNode.async,
              context.customContext.fileBasedParameters,
            ),
          ),
      });
      return;
    }
  }
}
const handleGenerateStaticParamsInnerReturnTypeOfArray = (
  paramsMember: TSTypeLiteral,
  { ruleContext, customContext }: Context,
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

  const actualParamNames = customContext.fileBasedParameters.map(
    (param) => param.name,
  );
  const unAllowedParams = params.filter(
    (param) => param.name == null || !actualParamNames.includes(param.name),
  );
  if (unAllowedParams.length > 0) {
    ruleContext.report({
      loc: paramsMember.loc,
      messageId: "issue:unknown-parameter",
      data: { name: unAllowedParams[0]!.name },
      fix: (fixer) =>
        fixer.replaceTextRange(
          paramsMember.range,
          stringifyTypeNode(
            createInnerTSTypeForGenerateStaticParams(
              customContext.fileBasedParameters,
            ),
          ),
        ),
    });
    return;
  }
  const routeParams = customContext.fileBasedParameters
    .filter((param) => !param.catchAll)
    .map((param) => param.name);

  const catchAllParams = customContext.fileBasedParameters
    .filter((param) => param.catchAll)
    .map((param) => param.name);

  const mustBeString = params.find((param) =>
    routeParams.find((p) => param.name === p && param.type !== "string"),
  );
  if (mustBeString) {
    reportWrongParameterIssue(
      { customContext, ruleContext },
      paramsMember,
      mustBeString.range,
      {
        name: mustBeString.name,
        type: "string",
      },
    );
    return;
  }

  const mustBeStringArray = params.find((param) =>
    catchAllParams.find((p) => param.name === p && param.type !== "string[]"),
  );

  if (mustBeStringArray) {
    reportWrongParameterIssue(
      { customContext, ruleContext },
      paramsMember,
      mustBeStringArray.range,
      {
        name: mustBeStringArray.name,
        type: "string[]",
      },
    );
    return;
  }

  const areNotAllLiteral = params.filter((param) => param.isLiteral === false);
  if (areNotAllLiteral.length > 0) {
    ruleContext.report({
      loc: paramsMember.loc,
      messageId: "issue:isNoLiteral",
    });
    return;
  }

  const requiredByFileName = customContext.fileBasedParameters.find(
    (param) => param.current,
  );
  if (requiredByFileName != null) {
    const typeInUhmParams = params.find(
      (param) => param.name === requiredByFileName.name,
    );
    if (typeInUhmParams == null || typeInUhmParams.optional) {
      ruleContext.report({
        loc: paramsMember.loc,
        messageId: "issue:isNoOptionalParam",
        data: { name: requiredByFileName.name },
        fix: (fixer) =>
          fixer.replaceTextRange(
            paramsMember.range,
            stringifyTypeNode(
              createInnerTSTypeForGenerateStaticParams(
                customContext.fileBasedParameters,
              ),
            ),
          ),
      });
      return;
    }
  }

  return { functionTypes: [], paramTypes: [] };
};

export const getFilename = (context: RuleContext<string, unknown[]>) =>
  path.basename(context.filename);

const toPosixPath = (p: string) => p.split(path.sep).join(posix.sep);

export const getFilePath = (context: RuleContext<string, unknown[]>) => {
  // const pathFromRoot = path.dirname(context.filename);
  return toPosixPath(path.dirname(context.filename));
};
