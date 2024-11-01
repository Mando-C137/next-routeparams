import type {
  ArrowFunctionExpression,
  FunctionExpression,
  FunctionDeclaration,
} from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type {
  CustomContext,
  MyRuleContext,
} from "../../../rules/enforce-route-params";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createGenerateStaticParamsReturntypeString } from "../../types/typeGenerator";
import { validateGenerateStaticParamsInnerReturnTypeOfArray } from "./validateReturntype";
import { findReferencedType } from "../findReferencedType";

export function validateGenerateStaticParamsFunction(
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
            `: ${createGenerateStaticParamsReturntypeString(
              functionNode.async,
              context.customContext.params,
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
            `: ${createGenerateStaticParamsReturntypeString(
              functionNode.async,
              context.customContext.params,
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
          `: ${createGenerateStaticParamsReturntypeString(
            functionNode.async,
            context.customContext.params,
          )}`,
        ),
    });
    return;
  }

  const arrayType = typeAnnotation.elementType;
  const arrayTypeAnnotation = arrayType.type;
  switch (arrayTypeAnnotation) {
    case AST_NODE_TYPES.TSTypeLiteral:
      validateGenerateStaticParamsInnerReturnTypeOfArray(arrayType, context);
      return;
    case AST_NODE_TYPES.TSTypeReference: {
      const type = findReferencedType(arrayType, context);
      if (type) {
        validateGenerateStaticParamsInnerReturnTypeOfArray(type, context);
        return;
      } else {
        context.ruleContext.report({
          loc: functionNode.loc,
          messageId: "issue:isNoLiteral",
          fix: (fixer) =>
            fixer.replaceTextRange(
              returnType.range,
              createGenerateStaticParamsReturntypeString(
                functionNode.async,
                context.customContext.params,
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
            createGenerateStaticParamsReturntypeString(
              functionNode.async,
              context.customContext.params,
            ),
          ),
      });
      return;
    }
  }
}
