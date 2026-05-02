import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintPlugin from "eslint-plugin-eslint-plugin";

export default [
  {
    ignores: ["**/dist", "**/*.js", "**/*.test.ts", "**/testdata.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs["flat/recommended"],
  eslintPlugin.configs.recommended,
  {
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "eslint-plugin/require-meta-docs-description": "error",
    },
  },
  ...tseslint.configs["flat/recommended-type-checked"].map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "tsconfig.json",
      },
    },
  },
];
