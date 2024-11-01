import type {
  TSTypeLiteral,
  TypeElement,
  TypeNode,
  TSTypeAnnotation,
} from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type { Context } from "../../rules/enforce-route-params";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { ALLOWED_PROPS_FOR_PAGE } from "../constants";
import { createParamsTypeNodeString } from "../types/typeGenerator";
import { reportWrongParameterIssue } from "../utils";
import { unwrapPromise } from "./unwrapPromise";
import { findReferencedType } from "./findReferencedType";

export function validateParams(paramsType: TSTypeLiteral, context: Context) {
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

  if (context.customContext.asyncRequestAPI) {
    const unwrappedPromise = unwrapPromise(paramsMember, (param) => {
      switch (param?.type) {
        case AST_NODE_TYPES.TSTypeLiteral:
          return param;
        case AST_NODE_TYPES.TSTypeReference:
          const type = findReferencedType(param, context);
          return type ?? undefined;
        default:
          return undefined;
      }
    });
    if (!unwrappedPromise.isPromise) {
      reportAsyncRequestApiWrongParameterIssue(
        context,
        paramsMember.typeAnnotation.typeAnnotation,
      );
      return;
    } else {
      validateParamsStructure(
        {
          typeToValidate: unwrappedPromise.promiseType,
          typeToReplace: paramsMember.typeAnnotation.typeAnnotation,
        },
        context,
      );
    }
  } else if (
    paramsMember.typeAnnotation.typeAnnotation.type ===
    AST_NODE_TYPES.TSTypeLiteral
  ) {
    validateParamsStructure(
      {
        typeToValidate: paramsMember.typeAnnotation.typeAnnotation,
        typeToReplace: paramsMember.typeAnnotation.typeAnnotation,
      },
      context,
    );
  }
}

function reportAsyncRequestApiWrongParameterIssue(
  context: Context,
  paramsTypeNode: TypeNode,
) {
  context.ruleContext.report({
    loc: paramsTypeNode.loc,
    messageId: "issue:asyncRequestApi-params",
    fix: (fixer) =>
      fixer.replaceTextRange(
        paramsTypeNode.range,
        createParamsTypeNodeString(context.customContext),
      ),
  });
}

export function getTypeOfMember(
  member: TypeElement,
): "string" | "string[]" | "other" {
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

function validateParamsStructure(
  {
    typeToValidate,
    typeToReplace,
  }: {
    typeToValidate: TSTypeLiteral | undefined;
    typeToReplace: TypeNode | TypeElement | TSTypeAnnotation;
  },
  context: Context,
) {
  if (!typeToValidate) {
    return;
  }

  const isExplicitlyTypedType =
    typeToValidate.type === AST_NODE_TYPES.TSTypeLiteral;
  if (!isExplicitlyTypedType) {
    // report an problem here definitely => must be a TSPropertySignature type
    context.ruleContext.report({
      loc: typeToReplace.loc,
      messageId: "issue:isNoLiteral",
    });
    return;
  }

  const params: {
    range: [number, number] | null;
    isLiteral: boolean;
    name: string | null;
    type: "string" | "string[]" | "other";
  }[] = typeToValidate.members.map((member) => ({
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

  const actualParamNames = context.customContext.params.map(
    (param) => param.name,
  );
  const unAllowedParams = params.filter(
    (param) => param.name == null || !actualParamNames.includes(param.name),
  );
  if (unAllowedParams.length > 0) {
    context.ruleContext.report({
      loc: typeToReplace.loc,
      messageId: "issue:unknown-parameter",
      data: { name: unAllowedParams[0]!.name },
      fix: (fixer) =>
        fixer.replaceTextRange(
          typeToReplace.range,
          createParamsTypeNodeString({
            asyncRequestAPI: context.customContext.asyncRequestAPI,
            params: context.customContext.params,
          }),
        ),
    });
  }
  const routeParams = context.customContext.params
    .filter((param) => !param.catchAll)
    .map((param) => param.name);

  const catchAllParams = context.customContext.params
    .filter((param) => param.catchAll)
    .map((param) => param.name);

  const mustBeString = params.find((param) =>
    routeParams.find((p) => param.name === p && param.type !== "string"),
  );
  if (mustBeString) {
    reportWrongParameterIssue(context, typeToValidate, mustBeString.range, {
      name: mustBeString.name,
      type: "string",
    });
  }

  const mustBeStringArray = params.find((param) =>
    catchAllParams.find((p) => param.name === p && param.type !== "string[]"),
  );

  if (mustBeStringArray) {
    reportWrongParameterIssue(
      context,
      typeToValidate,
      mustBeStringArray.range,
      {
        name: mustBeStringArray.name,
        type: "string[]",
      },
    );
  }

  const areNotAllLiteral = params.filter((param) => param.isLiteral === false);
  if (areNotAllLiteral.length > 0) {
    context.ruleContext.report({
      loc: typeToValidate.loc,
      messageId: "issue:isNoLiteral",
    });
  }
  return;
}
