import type { Context } from "../../rules/enforce-route-params";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSTypeReference } from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";

export function findReferencedType(
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
    ({ name, isTypeVariable }) =>
      name === nameOfReferencedType && isTypeVariable,
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
