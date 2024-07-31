import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import {
  appRouterFolderExists,
  handleFunctionParameters,
  isAppRouterFile,
  readDynamicParametes,
} from "../utils/utils";
import path from "path";

const createRule = ESLintUtils.RuleCreator(() => `https://www.paulhe.de/`);

// const RELEVANT_FUNCTIONS = [
//   "generateMetadata",
//   "generateMetadataFile",
//   "generateStaticParams",
// ];
// const RELEVANT_FILENAMES = ["page", "layout", "template"]; // maybe route

const messages = {
  "issue:isWrongParameterType": "{{ name }} must be of type {{ type }}",
  "issue:isNoLiteral": "Consideer using an explicit type annotation",
  "issue:unknown-parameter":
    "The param {{ name }} does not exist in the corresponding route path of this file",
  "issue:forbiddenPropertyKey": "The property {{ key }} is forbidden",
  "issue:wrong-searchParams-type": "searchParams must be of type nick",
} as const;
export type MessageKeys = keyof typeof messages;

export const enforceRouteParamsRule = createRule({
  name: "enforce-route-params",
  meta: {
    docs: {
      requiresTypeChecking: true,
      description:
        "enforce correct route parameters built by Next.js' file based routes",
    },
    type: "problem",
    messages: messages,
    schema: [],
    fixable: "code",
    hasSuggestions: false,
  },
  defaultOptions: [],

  create: (context) => {
    const filename = context.physicalFilename
      .split(path.sep)
      .join(path.posix.sep);

    const appDirectoryExists = appRouterFolderExists(filename);

    let nameOfDefaultExport: string | null = null;

    if (!appDirectoryExists) {
      return {};
    }
    const isAppRouterFileName = isAppRouterFile(filename);
    if (!isAppRouterFileName) {
      return {};
    }
    const dynamicFolders = readDynamicParametes(filename);

    return {
      // ExportNamedDeclaration(node) {},

      ExportDefaultDeclaration(node) {
        if (node.declaration.type === AST_NODE_TYPES.Identifier) {
          nameOfDefaultExport = node.declaration.name;
          return;
        }

        // it is not a default function export
        if (!(node.declaration.type === AST_NODE_TYPES.FunctionDeclaration)) {
          return;
        }
        handleFunctionParameters({
          actualParams: dynamicFolders,
          context,
          functionParameters: node.declaration.params,
        });
      },

      "Program:exit"() {
        if (nameOfDefaultExport) {
          const variable = context.sourceCode.scopeManager?.variables?.find(
            (variable) => variable.name === nameOfDefaultExport,
          );

          if (variable) {
            const node = variable.defs[0]?.node;
            // Perform your custom logic on the declaration node here
            if (node?.type === AST_NODE_TYPES.VariableDeclarator && node.init) {
              const initNode = node.init;
              if (
                initNode.type === AST_NODE_TYPES.ArrowFunctionExpression ||
                initNode.type === AST_NODE_TYPES.FunctionExpression
              ) {
                // Add your custom logic for the function node here
                handleFunctionParameters({
                  actualParams: dynamicFolders,
                  context,
                  functionParameters: initNode.params,
                });
              }
            } else if (node?.type === AST_NODE_TYPES.FunctionDeclaration) {
              handleFunctionParameters({
                actualParams: dynamicFolders,
                context,
                functionParameters: node.params,
              });
            }
          }
        }
      },
    };
  },
});
