import type { AnyRuleModule } from "@typescript-eslint/utils/ts-eslint";
import enforceRouteParamsRule from "./rules/enforce-route-params";

export const rules = {
  "enforce-route-params": enforceRouteParamsRule,
} satisfies Record<string, AnyRuleModule>;
