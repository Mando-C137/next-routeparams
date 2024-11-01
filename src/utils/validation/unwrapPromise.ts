import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type {
  TypeElement,
  TypeNode,
} from "node_modules/@typescript-eslint/types/dist/generated/ast-spec";

export function unwrapPromise<TReturntype>(
  potentialPromise: TypeElement | undefined,
  fn: (param: TypeNode | undefined) => TReturntype | undefined,
): {
  isPromise: boolean;
  promiseType: TReturntype | undefined;
};
export function unwrapPromise(potentialPromise: TypeElement | undefined): {
  isPromise: boolean;
  promiseType: TypeNode | undefined;
};
export function unwrapPromise<TReturntype>(
  potentialPromise: TypeElement | undefined,
  fn?: (param: TypeNode | undefined) => TReturntype | undefined,
): {
  isPromise: boolean;
  promiseType:
    | (typeof fn extends undefined ? TypeNode : TReturntype)
    | undefined;
} {
  if (
    potentialPromise != null &&
    potentialPromise.type === AST_NODE_TYPES.TSPropertySignature &&
    potentialPromise.typeAnnotation?.typeAnnotation.type ===
      AST_NODE_TYPES.TSTypeReference
  ) {
    const typeName = potentialPromise.typeAnnotation.typeAnnotation.typeName;

    if (
      typeName.type === AST_NODE_TYPES.Identifier &&
      typeName.name === "Promise"
    ) {
      const firstParam =
        potentialPromise.typeAnnotation.typeAnnotation.typeArguments?.params[0];

      const promiseType = fn != null ? fn(firstParam) : firstParam;
      return {
        isPromise: true,
        promiseType: promiseType as TReturntype,
      };
    }
  }

  return { isPromise: false, promiseType: undefined };
}
