import type { TSTypeLiteral } from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type { Context } from "../../../rules/enforce-route-params";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { getTypeOfMember } from "../validateParams";
import { reportWrongParameterIssue } from "../../utils";
import { createGenerateStaticParamsReturntypeArrayArgumentString } from "../../types/typeGenerator";

export const validateGenerateStaticParamsInnerReturnTypeOfArray = (
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

  const actualParamNames = customContext.params.map((param) => param.name);
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
          createGenerateStaticParamsReturntypeArrayArgumentString(
            customContext.params,
          ),
        ),
    });
    return;
  }
  const routeParams = customContext.params
    .filter((param) => !param.catchAll)
    .map((param) => param.name);

  const catchAllParams = customContext.params
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

  const requiredByFileName = customContext.params.find(
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
            createGenerateStaticParamsReturntypeArrayArgumentString(
              customContext.params,
            ),
          ),
      });
      return;
    }
  }

  return { functionTypes: [], paramTypes: [] };
};
