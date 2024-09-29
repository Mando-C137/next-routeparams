import {
  appRouterFolderExists,
  handleFunctionParameters,
  handleGenerateStaticParamsFunction,
  isAppRouterFile,
  readFileBasedParameters,
  getFilename,
  getFilePath,
} from "../utils/utils";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import type {
  InferMessageIdsTypeFromRule,
  InferOptionsTypeFromRule,
} from "@typescript-eslint/utils/eslint-utils";

const createRule = ESLintUtils.RuleCreator(
  () => `https://www.paulhe.de/blog/next-route-params-eslint-rule`,
);

const METADATA_FUNCTIONS = [
  "generateMetadata",
  "generateMetadataFile",
] as ReadonlyArray<string>;
const GENERATE_STATIC_PARAMS_FUNCTION_NAME = "generateStaticParams";

export type Options = InferOptionsTypeFromRule<typeof enforceRouteParamsRule>;
export type MessageIds = InferMessageIdsTypeFromRule<
  typeof enforceRouteParamsRule
>;
export type MyRuleContext = RuleContext<MessageIds, Options>;

const enforceRouteParamsRule = createRule({
  name: "enforce-route-params",
  meta: {
    docs: {
      description:
        "enforce correct route parameters built by Next.js' file based routes",
    },
    type: "problem",
    messages: {
      "issue:isWrongParameterType": "{{ name }} must be of type {{ type }}",
      "issue:isNoLiteral": "Consider using an explicit type annotation",
      "issue:unknown-parameter":
        "The param {{ name }} does not exist in the corresponding route path of this file",
      "issue:forbiddenPropertyKey": "The property {{ key }} is forbidden",
      "issue:wrong-searchParams-type":
        "searchParams must be of type { [key: string]: string | string[] | undefined }",
      "issue:no-returntype": "The function must specify a returntype",
      "issue:wrong-returntype":
        "The function must specify a correct returntype",
      "issue:isNoOptionalParam": "The param {{ name }} must not be optional",
    },
    schema: [
      {
        type: "object",
        properties: {
          searchParams: {
            type: "boolean",
            enum: [true, false],
            default: true,
            description:
              "If true, also strictly validates searchParams and enforces that the searchParams parameter is of type { [key: string]: string | string[] | undefined }",
          },
        },
        additionalProperties: false,
      },
    ],

    fixable: "code",
    hasSuggestions: false,
  },
  defaultOptions: [
    {
      searchParams: true,
    },
  ],

  create: (context, options) => {
    const filePath = getFilePath(context);
    const filename = getFilename(context);

    const appDirectoryExists = appRouterFolderExists(filePath);

    if (!appDirectoryExists) {
      return {};
    }
    const isAppRouterFileName = isAppRouterFile(filename);
    if (!isAppRouterFileName) {
      return {};
    }
    const fileBasedParameters = readFileBasedParameters(filePath);

    let nameOfDefaultExport: string | null = null;

    return {
      FunctionDeclaration(node) {
        if (node.id?.name === GENERATE_STATIC_PARAMS_FUNCTION_NAME) {
          handleGenerateStaticParamsFunction(
            fileBasedParameters,
            node,
            context,
          );
        } else if (
          node.id?.name &&
          METADATA_FUNCTIONS.includes(node.id?.name) &&
          node.params[0] != null
        ) {
          handleFunctionParameters({
            fileBasedParameters,
            context,
            options,
            props: node.params[0],
          });
        }
      },

      // Handle variable declarations with arrow functions
      VariableDeclarator(node) {
        if (
          (node.init?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            node.init?.type === AST_NODE_TYPES.FunctionExpression) &&
          node.id.type === AST_NODE_TYPES.Identifier
        ) {
          if (node.id.name === GENERATE_STATIC_PARAMS_FUNCTION_NAME) {
            handleGenerateStaticParamsFunction(
              fileBasedParameters,
              node.init,
              context,
            );
          } else if (
            METADATA_FUNCTIONS.includes(node.id?.name) &&
            node.init.params[0] != null
          ) {
            handleFunctionParameters({
              fileBasedParameters,
              context,
              options,
              props: node.init.params[0],
            });
          }
        }
      },

      ExportDefaultDeclaration(node) {
        if (node.declaration.type === AST_NODE_TYPES.Identifier) {
          nameOfDefaultExport = node.declaration.name;
          return;
        }

        // it is not a default function export
        if (
          !(node.declaration.type === AST_NODE_TYPES.FunctionDeclaration) ||
          !node.declaration.params[0]
        ) {
          return;
        }

        handleFunctionParameters({
          fileBasedParameters,
          context,
          options,
          props: node.declaration.params[0],
        });
      },

      "Program:exit"() {
        if (nameOfDefaultExport) {
          const variable = context.sourceCode.scopeManager?.variables?.find(
            (variable) => variable.name === nameOfDefaultExport,
          );
          if (!variable) {
            return;
          }

          const node = variable.defs[0]?.node;
          // Perform your custom logic on the declaration node here
          if (node?.type === AST_NODE_TYPES.VariableDeclarator && node.init) {
            const initNode = node.init;
            if (
              (initNode.type === AST_NODE_TYPES.ArrowFunctionExpression ||
                initNode.type === AST_NODE_TYPES.FunctionExpression) &&
              initNode.params[0]
            ) {
              // Add your custom logic for the function node here
              handleFunctionParameters({
                fileBasedParameters: fileBasedParameters,
                context,
                options,
                props: initNode.params[0],
              });
            }
          } else if (
            node?.type === AST_NODE_TYPES.FunctionDeclaration &&
            node.params[0]
          ) {
            handleFunctionParameters({
              fileBasedParameters: fileBasedParameters,
              context,
              options,
              props: node.params[0],
            });
          }
        }
      },
    };
  },
});
export default enforceRouteParamsRule;
