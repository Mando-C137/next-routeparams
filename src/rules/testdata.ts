import { RuleTester, type ValidTestCase } from "@typescript-eslint/rule-tester";
import path from "path";
import fs from "fs";
import parser from "@typescript-eslint/parser";
import rule, { type Options } from "./enforce-route-params";
import type { ValidRunTests } from "./enforce-route-params.next13.test";

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: {
      tsconfigRootDir: path.resolve(__dirname, "../../"),
      project: "tsconfig.json",
    },
  },
});

export const createTester = (testCases: ValidRunTests) => {
  const validtestFiles = (testCases.valid as ValidTestCase<Options>[]).map(
    ({ filename }) => filename,
  );
  const invalidTestFiles = testCases.invalid.map(({ filename }) => filename);
  const allTestFiles = [
    ...new Set([...validtestFiles, ...invalidTestFiles]),
  ].filter((val) => val != null);

  return {
    runTests: () => ruleTester.run("enforce-route-params", rule, testCases),
    setUp: () => {
      allTestFiles.forEach((testFilename) => {
        const normalizedTestFilename = path.normalize(testFilename);
        const fileAlreadyExists = fs.existsSync(normalizedTestFilename);
        const directory = path.dirname(normalizedTestFilename);
        const directoriesExistedBeforeTest = fs.existsSync(directory);

        if (!directoriesExistedBeforeTest) {
          fs.mkdirSync(directory, { recursive: true });
        }
        if (!fileAlreadyExists) {
          fs.writeFileSync(testFilename, "");
        }
      });
    },
    cleanUp: () => {
      const appDirectory = path.join(process.cwd(), "src/app");
      if (fs.existsSync(appDirectory)) {
        fs.rmSync(appDirectory, { recursive: true, force: true });
      }
    },
  };
};
