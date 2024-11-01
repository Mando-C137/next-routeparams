import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type {
  TSPropertySignature,
  Parameter,
  TypeElement,
  TSTypeLiteral,
} from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type { Context, Options } from "../rules/enforce-route-params";
import { validateSearchParams } from "./validation/validateSearchParams";
import { validateParams } from "./validation/validateParams";
import { findReferencedType } from "./validation/findReferencedType";

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

export function reportWrongParameterIssue(
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
  propsType: TSTypeLiteral,
  context: Context,
  options: Readonly<Options>,
) {
  propsType.members
    .filter(
      (member): member is TSPropertySignature & { key: { name: string } } =>
        member.type === AST_NODE_TYPES.TSPropertySignature &&
        member.key.type === AST_NODE_TYPES.Identifier &&
        !context.customContext.allowedPropsForFileNameType?.includes(
          member.key.name,
        ),
    )
    .forEach((member) => {
      context.ruleContext.report({
        loc: member.loc,
        messageId: "issue:forbiddenPropertyKey",
        data: { key: member.key.name },
        fix: (fixer) => {
          const sourceCode = context.ruleContext.sourceCode;
          const tokenBefore = sourceCode.getTokenBefore(member);
          const tokenAfter = sourceCode.getTokenAfter(member);

          // Check if there's a trailing comma or a leading comma for handling commas in lists
          let rangeToRemove = member.range;
          if (tokenAfter && tokenAfter.value === ",") {
            rangeToRemove = [member.range[0], tokenAfter.range[1]];
          } else if (tokenBefore && tokenBefore.value === ",") {
            rangeToRemove = [tokenBefore.range[0], member.range[1]];
          }
          return fixer.removeRange(rangeToRemove);
        },
      });
    });

  if (options[0].searchParams) {
    validateSearchParams(propsType, context);
  }
  validateParams(propsType, context);
}
