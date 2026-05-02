import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    reporters: ["default"],
    coverage: {
      enabled: true,
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
      thresholds: {
        lines: 89,
        functions: 90,
      },
    },
  },
});
