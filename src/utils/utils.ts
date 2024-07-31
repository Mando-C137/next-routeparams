import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type {
  Parameter,
  TSTypeAnnotation,
  TSTypeLiteral,
  TSTypeReference,
  TypeElement,
} from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type { MessageKeys } from "src/rules/enforce-route-params";

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
export function appRouterFolderExists(fileName: string) {
  return fileName.split("/").some((folder) => folder === "app");
}

/**
 *
 *
 * @param fileName the filename containing the folders, the separator must be "/"
 * @returns a list of the dynamic parameters and if if they are catch all parameters
 */
export function readDynamicParametes(
  fileName: string,
): { catchAll: boolean; name: string }[] {
  const folders = fileName.split("/");

  const appPosition = folders.findIndex((folder) => folder === "app");
  if (appPosition === -1) {
    return [];
  }
  return folders
    .slice(appPosition)
    .filter((folder) => folder.startsWith("[") && folder.endsWith("]"))
    .map((folder) => {
      const isCatchAll = folder.startsWith("[...");
      const name = folder.slice(isCatchAll ? 4 : 1, -1);
      return { catchAll: isCatchAll, name };
    });
}

export function handleFunctionParameters({
  functionParameters,
  context,
  actualParams,
}: {
  functionParameters: Parameter[];
  actualParams: ReturnType<typeof readDynamicParametes>;
  context: Readonly<RuleContext<MessageKeys, unknown[]>>;
}) {
  if (functionParameters.length !== 1) {
    // if there is no parameter, do not do anything ==> still ok
    return;
  }

  const firstAndOnlyParameter = functionParameters[0]!;

  // no type annotation => could mean that is not using noImplicitAny
  if (!("typeAnnotation" in firstAndOnlyParameter)) {
    return;
  }
  const innerTypeAnnotation =
    firstAndOnlyParameter.typeAnnotation?.typeAnnotation;

  switch (innerTypeAnnotation?.type) {
    case AST_NODE_TYPES.TSTypeLiteral:
      validateFirstParameter(innerTypeAnnotation, context, actualParams);
      break;
    case AST_NODE_TYPES.TSTypeReference:
      const referencedTSTypeLiteral = findReferencedType(
        innerTypeAnnotation,
        context,
      );
      if (referencedTSTypeLiteral != null) {
        validateFirstParameter(referencedTSTypeLiteral, context, actualParams);
      }
  }
}

function createCorrectParamsType(slugs: { catchAll: boolean; name: string }[]) {
  if (slugs.length === 0) {
    return ": Record<string, never>";
  }
  return `: { ${slugs
    .map((key) => `${key.name}: ${key.catchAll ? "string[]" : "string"}`)
    .join(", ")} }`;
}

export const createCorrectSearchParamsType = () =>
  ": { [key: string]: string | string[] | undefined }" as const;

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
  context: Readonly<RuleContext<MessageKeys, unknown[]>>,
  paramsTypeNode: TypeElement,
  wrongTypeRange: [number, number] | null,
  data: { name: string | null; type: "string" | "string[]" },
) {
  context.report({
    node: paramsTypeNode,
    messageId: "issue:isWrongParameterType",
    data,
    fix: (fixer) => fixer.replaceTextRange(wrongTypeRange!, data.type),
  });
}

function validateFirstParameter(
  paramsType: TSTypeLiteral,
  context: Readonly<RuleContext<MessageKeys, unknown[]>>,
  actualParams: ReturnType<typeof readDynamicParametes>,
) {
  paramsType.members
    .filter(
      (
        member,
      ): member is typeof member & {
        type: AST_NODE_TYPES.TSPropertySignature;
        key: { type: AST_NODE_TYPES.Identifier };
      } =>
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
        node: member,
        messageId: "issue:forbiddenPropertyKey",
        data: { key: member.key.name },
        fix: (fixer) =>
          fixer.removeRange([member.key.range[0], typeAnnotationRange]),
      });
    });

  validateSearchParamsMember(paramsType, context);
  validateParamsMember(paramsType, context, actualParams);
}

function findReferencedType(
  typeReference: TSTypeReference,
  context: Readonly<RuleContext<MessageKeys, unknown[]>>,
) {
  if (typeReference.typeName.type !== AST_NODE_TYPES.Identifier) {
    context.report({
      node: typeReference,
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
      node: typeReference,
      messageId: "issue:isNoLiteral",
    });
    return null;
  }
  return node.typeAnnotation;
}

function validateParamsMember(
  paramsType: TSTypeLiteral,
  context: RuleContext<MessageKeys, unknown[]>,

  actualParams: ReturnType<typeof readDynamicParametes>,
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
      node: paramsMember,
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
        ? member.typeAnnotation?.typeAnnotation.range ?? null
        : null,
    isLiteral:
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      member.key.type === AST_NODE_TYPES.Identifier,
    type: getTypeOfMember(member),
    name: "key" in member && "name" in member.key ? member.key.name : null,
  }));

  const actualParamNames = actualParams.map((param) => param.name);
  const unAllowedParams = params.filter(
    (param) => param.name == null || !actualParamNames.includes(param.name),
  );
  if (unAllowedParams.length > 0) {
    context.report({
      node: paramsMember.typeAnnotation,
      messageId: "issue:unknown-parameter",
      data: { name: unAllowedParams[0]!.name },
      fix: (fixer) =>
        fixer.replaceTextRange(
          paramsMember.typeAnnotation!.range,
          createCorrectParamsType(actualParams),
        ),
    });
  }
  const routeParams = actualParams
    .filter((param) => !param.catchAll)
    .map((param) => param.name);

  const catchAllParams = actualParams
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
      node: paramsMember,
      messageId: "issue:isNoLiteral",
    });
  }
  return { functionTypes: [], paramTypes: [] };
}

function validateSearchParamsMember(
  paramsType: TSTypeLiteral,
  context: RuleContext<MessageKeys, unknown[]>,
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
      node: searchParamsMember!,
      messageId: "issue:wrong-searchParams-type",
      fix: (fixer) =>
        fixer.replaceTextRange(node.range, createCorrectSearchParamsType()),
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
  if (members.length === 0) {
    return;
  }
  if (members.length !== 1) {
    return;
  }
  const member = members[0]!;
  if (member.type !== AST_NODE_TYPES.TSIndexSignature) {
    return;
  }
  if (member.typeAnnotation?.type !== AST_NODE_TYPES.TSTypeAnnotation) {
    return;
  }
  if (
    member.typeAnnotation.typeAnnotation.type !== AST_NODE_TYPES.TSUnionType
  ) {
    return;
  }
  const unionType = member.typeAnnotation.typeAnnotation;
  const areAllowedSearchParamsTypes = unionType.types.every(
    (element) =>
      element.type === AST_NODE_TYPES.TSStringKeyword ||
      (element.type === AST_NODE_TYPES.TSArrayType &&
        element.elementType.type === AST_NODE_TYPES.TSStringKeyword) ||
      element.type === AST_NODE_TYPES.TSUndefinedKeyword,
  );
  if (!areAllowedSearchParamsTypes) {
    reportWrongSearchParamsTypeIssue(searchParamsMember.typeAnnotation);
  }
}
