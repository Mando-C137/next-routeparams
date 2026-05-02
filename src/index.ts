import type { AnyRuleModule } from "@typescript-eslint/utils/ts-eslint";
import enforceRouteParamsRule from "./rules/enforce-route-params";

const plugin = {
  rules: {
    "enforce-route-params": enforceRouteParamsRule,
  },
} satisfies { rules: Record<string, AnyRuleModule> };

export default plugin;
