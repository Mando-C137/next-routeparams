import type {
  TSTypeLiteral,
  TypeNode,
} from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type { Context } from "../../rules/enforce-route-params";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { SEARCHPARAMS_PROP_NAME } from "../constants";
import { unwrapPromise } from "./unwrapPromise";
import { SEARCHPARAMS_TYPE_NODE_STRING } from "../types/typeGenerator";

export function validateSearchParams(
  propsType: TSTypeLiteral,
  { ruleContext, customContext }: Context,
) {
  const searchParamsMember = propsType.members.find(
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
  function reportWrongSearchParamsTypeIssue(
    node: TypeNode,
    asyncRequestApi: boolean,
  ) {
    ruleContext.report({
      loc: searchParamsMember!.loc,
      messageId: "issue:wrong-searchParams-type",
      data: { promiseOrEmpty: asyncRequestApi ? "a Promise" : "" },
      fix: (fixer) =>
        fixer.replaceTextRange(
          node.range,
          SEARCHPARAMS_TYPE_NODE_STRING(asyncRequestApi),
        ),
    });
  }

  let typeToValidate: TypeNode | undefined;
  if (customContext.asyncRequestAPI) {
    const isPromise = unwrapPromise(searchParamsMember);
    if (!isPromise.isPromise) {
      reportWrongSearchParamsTypeIssue(
        searchParamsMember.typeAnnotation.typeAnnotation,
        true,
      );
      return;
    } else {
      typeToValidate = isPromise.promiseType;
    }
  } else {
    typeToValidate = searchParamsMember.typeAnnotation.typeAnnotation;
  }

  //first check if the searchParams property is allowed
  const isSearchParamsAllowedByFilenameType =
    customContext.allowedPropsForFileNameType?.includes(SEARCHPARAMS_PROP_NAME);
  if (!isSearchParamsAllowedByFilenameType) {
    return; // no need to report the error because it is already done in validateFirstParameter
  }

  const isValid = validateSearchParamsStructure(typeToValidate);
  if (!isValid) {
    reportWrongSearchParamsTypeIssue(
      searchParamsMember.typeAnnotation.typeAnnotation,
      !!customContext.asyncRequestAPI,
    );
  }
}

function validateSearchParamsStructure(member: TypeNode | undefined) {
  return (
    validateRecordTypeStructure(member) ||
    validateIndexSignatureStructure(member)
  );
}

function validateIndexSignatureStructure(member: TypeNode | undefined) {
  if (!member || member.type !== AST_NODE_TYPES.TSTypeLiteral) {
    return false;
  }
  const members = member.members;
  if (members.length !== 1) {
    return false;
  }
  const firstMember = members[0]!;

  if (
    firstMember?.type !== AST_NODE_TYPES.TSIndexSignature ||
    firstMember.typeAnnotation?.type !== AST_NODE_TYPES.TSTypeAnnotation ||
    firstMember.typeAnnotation.typeAnnotation.type !==
      AST_NODE_TYPES.TSUnionType
  ) {
    return false;
  }

  const unionType = firstMember.typeAnnotation?.typeAnnotation;
  const areAllowedSearchParamsTypes = extractTypes(unionType.types);

  if (
    areAllowedSearchParamsTypes == null ||
    Object.values(areAllowedSearchParamsTypes).includes(false)
  ) {
    return false;
  }
  return true;
}

/**
 * required that input type is ```Record<string, string | string[] | undefined>```
 */
function validateRecordTypeStructure(typeNode: TypeNode | undefined): boolean {
  if (!typeNode || typeNode.type !== AST_NODE_TYPES.TSTypeReference) {
    return false;
  }

  // Ensure the base type is Record
  if (
    typeNode.typeName.type !== AST_NODE_TYPES.Identifier ||
    typeNode.typeName.name !== "Record"
  ) {
    return false;
  }

  const typeArguments = typeNode.typeArguments?.params;
  if (!typeArguments || typeArguments.length !== 2) {
    return false;
  }

  const [keyType, valueType] = typeArguments;

  // Check if key type is string
  if (keyType?.type !== AST_NODE_TYPES.TSStringKeyword) {
    return false;
  }

  // Check if value type is a union of string, string[], and undefined
  if (valueType?.type !== AST_NODE_TYPES.TSUnionType) {
    return false;
  }
  const allowedValueTypes = extractTypes(valueType.types);

  if (
    allowedValueTypes == null ||
    Object.values(allowedValueTypes).includes(false)
  ) {
    return false;
  }

  return true;
}

function extractTypes(types: TypeNode[]) {
  return types.reduce(
    (acc, element) => {
      if (acc == null) {
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
}
