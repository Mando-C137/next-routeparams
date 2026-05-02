import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type {
  TSPropertySignature,
  Parameter,
  TypeElement,
  TSTypeLiteral,
  TSTypeAnnotation,
} from "../../node_modules/@typescript-eslint/types/dist/generated/ast-spec";
import type { Context, Options } from "../rules/enforce-route-params";
import { validateSearchParams } from "./validation/validateSearchParams";
import { validateParams } from "./validation/validateParams";
import { findReferencedType } from "./validation/findReferencedType";

const HELPER_TYPE_MAP: Record<"page" | "layout" | "route" | "default", string> =
  {
    page: "PageProps",
    layout: "LayoutProps",
    route: "RouteContext",
    default: "LayoutProps",
  };

function getHelperTypeForFile(context: Context): string | null {
  const fileNameType = context.customContext.appRouterFilename;
  if (!fileNameType || !(fileNameType in HELPER_TYPE_MAP)) {
    return null;
  }
  return HELPER_TYPE_MAP[fileNameType];
}

function isCorrectHelperType(
  typeAnnotation: TSTypeAnnotation,
  helperType: string,
): boolean {
  const inner = typeAnnotation.typeAnnotation;
  if (
    !inner ||
    typeof inner !== "object" ||
    inner.type !== AST_NODE_TYPES.TSTypeReference
  ) {
    return false;
  }
  const typeRef = inner;
  if (
    typeRef.typeName.type !== AST_NODE_TYPES.Identifier ||
    typeRef.typeName.name !== helperType
  ) {
    return false;
  }
  return true;
}

function getHelperTypePath(typeAnnotation: TSTypeAnnotation): string | null {
  const inner = typeAnnotation.typeAnnotation;
  if (typeof inner !== "object" || !inner) {
    return null;
  }
  const node = inner;
  if (node.type !== AST_NODE_TYPES.TSTypeReference) {
    return null;
  }
  const typeRef = inner;
  if (
    !("typeArguments" in typeRef) ||
    !typeRef.typeArguments ||
    typeRef.typeArguments.params.length === 0
  ) {
    return null;
  }
  const firstParam = typeRef.typeArguments.params[0];
  if (!firstParam || firstParam.type !== AST_NODE_TYPES.TSLiteralType) {
    return null;
  }
  const literal = firstParam.literal;
  if (
    literal.type !== AST_NODE_TYPES.Literal ||
    typeof literal.value !== "string"
  ) {
    return null;
  }
  return literal.value;
}

export function handleFunctionParameters({
  props,
  context,
  options,
  allowHelperTypes = false,
  forGenerateStaticParams = false,
}: {
  props: Parameter;
  options: Readonly<Options>;
  context: Context;
  allowHelperTypes?: boolean;
  forGenerateStaticParams?: boolean;
}) {
  // no type annotation => could mean that is not using noImplicitAny
  if (!props || !("typeAnnotation" in props)) {
    return;
  }

  // Handle generateStaticParams params with helperTypes
  if (forGenerateStaticParams && options[0]?.helperTypes) {
    const parentRoutePath = context.customContext.parentRoutePath;
    if (parentRoutePath != null && props.typeAnnotation) {
      const sourceCode = context.ruleContext.sourceCode;
      const currentText = sourceCode.getText(
        props.typeAnnotation.typeAnnotation,
      );

      const hasCorrectPageProps =
        currentText.includes(`PageProps<'${parentRoutePath}'>`) ||
        currentText.includes(`PageProps<"${parentRoutePath}">`);

      if (hasCorrectPageProps) {
        return;
      }

      const expectedType = `{ params?: Awaited<Omit<PageProps<'${parentRoutePath}'>, "searchParams">["params"]> }`;

      context.ruleContext.report({
        loc: props.typeAnnotation.loc,
        messageId: "issue:useHelperTypeForGenerateStaticParams",
        data: { routePath: parentRoutePath },
        fix: (fixer) =>
          fixer.replaceTextRange(
            props.typeAnnotation!.range,
            `: ${expectedType}`,
          ),
      });
      return;
    }
  }

  const innerTypeAnnotation = props.typeAnnotation?.typeAnnotation;

  // Check if helper types should be used for this file type
  if (allowHelperTypes && options[0]?.helperTypes) {
    const helperType = getHelperTypeForFile(context);
    const routePath = context.customContext.routePath;

    if (helperType && routePath && props.typeAnnotation) {
      const typeAnnotation = props.typeAnnotation;

      if (isCorrectHelperType(typeAnnotation, helperType)) {
        const actualPath = getHelperTypePath(typeAnnotation);

        if (actualPath === routePath) {
          return;
        }

        context.ruleContext.report({
          loc: typeAnnotation.loc,
          messageId: "issue:wrong-helperType-path",
          data: {
            helperType,
            expectedPath: routePath,
            actualPath: actualPath ?? "not specified",
          },
          fix: (fixer) =>
            fixer.replaceTextRange(
              typeAnnotation.range,
              `: ${helperType}<'${routePath}'>`,
            ),
        });
        return;
      }

      // Report and auto-fix to use the helper type
      context.ruleContext.report({
        loc: typeAnnotation.loc,
        messageId: "issue:useHelperType",
        data: {
          helperType,
          routePath,
        },
        fix: (fixer) =>
          fixer.replaceTextRange(
            typeAnnotation.range,
            `: ${helperType}<'${routePath}'>`,
          ),
      });
      return;
    }
  }

  switch (innerTypeAnnotation?.type) {
    case AST_NODE_TYPES.TSTypeLiteral:
      validateFirstParameter(innerTypeAnnotation, context, options);
      break;
    case AST_NODE_TYPES.TSTypeReference: {
      const referencedTSTypeLiteral = findReferencedType(
        innerTypeAnnotation,
        context,
      );
      if (referencedTSTypeLiteral != null) {
        validateFirstParameter(referencedTSTypeLiteral, context, options);
      }
      break;
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

  if (options[0]?.searchParams) {
    validateSearchParams(propsType, context);
  }
  validateParams(propsType, context);
}
