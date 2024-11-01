/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  reporters: [["github-actions", { silent: false }], "summary", "default"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  testPathIgnorePatterns: ["dist"],
  coverageThreshold: {
    global: {
      lines: 90,
      functions: 90,
    },
  },
};
