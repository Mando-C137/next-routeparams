import rule from "./enforce-route-params";
import path from "path";
import fs from "fs";
import { correctSearchParamsTypeAnnotation } from "../utils/utils";
import type {
  InferMessageIdsTypeFromRule,
  InferOptionsTypeFromRule,
} from "@typescript-eslint/utils/eslint-utils";
import { RuleTester, type RunTests } from "@typescript-eslint/rule-tester";
import parser from "@typescript-eslint/parser";

const ruleTester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: {
      tsconfigRootDir: path.resolve(__dirname, "../../"),
      project: "tsconfig.json",
    },
  },
});
const allCases = {
  valid: [
    {
      name: "generateStaticParams allows returntype of one param 'id' is working",
      code: `export const generateStaticParams = () : {id: string }[] => []`,
      filename: "src/app/movies/[id]/page.tsx",
    },
    {
      name: "The params of the default exported function has all file-based parameter keys ",
      code: `export default async function ReviewPage(
                     parameters
                  : {
                  params: { reviewId: string; id: string };
                }) {
                return null;
                }

                export const generateStaticParams = async function(parameters : {params : { id : string}}): Promise<{ id: string; reviewId?: string}[]> {
                  return null;
              }
                `,
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
    },
    {
      name: "The params of the default exported function has one of the file-based parameter keys ",
      code: "export default async function Page( parameters: { params: {id : string}}){return <div>Hallo</div>;}",
      filename: "src\\app\\movies\\[id]\\[reviewId]\\page.tsx",
    },
    {
      name: "The default exported function has no function parameters",
      code: "export default function Page(){return <></>;}",
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
    },
    {
      name: "The default exported function's parameter are defined as a TypeReference within the file",
      code: `
            type Params = { params : { ker: string }};
            export default function Page(paramters : Params){return <></>;}`,
      filename: "src/app/movies/[id]/[ker]/page.tsx",
    },
    {
      code: `
            export default function Page(parameters: { params: { id: string}, searchParams: { [key: string]: string | string[] | undefined } }) {
            return null;}`,
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
    },

    {
      name: "A function which is later default exported is validated as the route compoenent",
      code: `export const generateMetadata = (parameters : { params : {id: string}}) => null;
            function Lawl(){
              return  null;
            }
            export default Lawl;
            `,
      filename: "src/app/movies/[id]/page.tsx",
    },
    {
      name: "A function which is later default exported has the correct parameter type",
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams: { [key: string]: string | string[] | undefined } }) {
              return  null;
            }
            export default Page;
            `,
      filename: "src/app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: "searchParams also allows Array<string> instead of string[]",
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams: { [lol: string]: string | Array<string> | undefined } }) {
              return  null;
            }
            export default Page;
            `,
      filename: "src/app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: ` The correct type of searchParams is validated`,
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams${correctSearchParamsTypeAnnotation} }) {
              return  null;
            }
            export default Page;
            `,
      filename: "src/app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: "A correct params type for generateMetadata is validated",
      code: `export function generateMetadata(parameters : 
      { params: { id: string, other: string[] }, searchParams: { [key: string]: string | string[] | undefined } }) { return null; } `,
      filename: "src/app/movies/[id]/[...other]/page.tsx",
    },
  ],
  invalid: [
    {
      name: "Replace wrong parameter type of route-param in TSTypeLiteral",
      code: `
            export default async function Page(parameters: { params: { id: number } }) {
              return <div>Hallo</div>;
            }
            `,
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
      output: `
            export default async function Page(parameters: { params: { id: string } }) {
              return <div>Hallo</div>;
            }
            `,
      errors: [
        {
          messageId: "issue:isWrongParameterType",
          data: { name: "id", type: "string" },
        },
      ],
    },
    {
      name: "Replace unknown parameter in TSTypeLiteral",
      code: `
            export default function Page(parameters: { params: { ids: number } }) {
              return <></>;
            }
            `,
      output: `
            export default function Page(parameters: { params: { id: string, reviewId: string } }) {
              return <></>;
            }
            `,
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
      errors: [{ messageId: "issue:unknown-parameter", data: { name: "ids" } }],
    },
    {
      name: "Replace type params and keep searchParams in TSTypeLiteral",
      code: `
            export default function Page(parameters: { params: { idBang: string }, searchParams: { [key: string]: string | string[] | undefined } }) {
            return null;}`,
      output: `
            export default function Page(parameters: { params: { id: string, reviewId: string }, searchParams: { [key: string]: string | string[] | undefined } }) {
            return null;}`,
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
      errors: [
        { messageId: "issue:unknown-parameter", data: { name: "idBang" } },
      ],
    },
    {
      name: "Remove unknown Parameter and add known paramter in TSTypeLiteral (1/2)",
      code: `
            export default function Page(paramters : { params : {iasd: string, id: string }}){return <></>;}`,
      output: `
            export default function Page(paramters : { params : { id: string, reviewId: string }}){return <></>;}`,
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
      errors: [
        { messageId: "issue:unknown-parameter", data: { name: "iasd" } },
      ],
    },
    {
      name: "Remove unknown Parameter and add known paramter in TSTypeLiteral (2/2)",
      code: `export default async function ReviewPage(
                  parameters
            : {
              params: { reviewId: string, idasdfasdf: string };
            }) {
              return null;
            }`,
      output: `export default async function ReviewPage(
                  parameters
            : {
              params: { id: string, reviewId: string };
            }) {
              return null;
            }`,
      filename: "src/app/movies/[id]/[reviewId]/page.tsx",
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "idasdfasdf" },
        },
      ],
    },
    {
      name: "Remove unknown Parameters to empty Object (Record<string, never>)",
      code: `
            export default async function ReviewPage({}: {
              params: { reviewId: string; idasdfasdf: string };
            }) {
              return null;
            }`,
      output: `
            export default async function ReviewPage({}: {
              params: Record<string, never>;
            }) {
              return null;
            }`,
      filename: "src/app/page.tsx",
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "reviewId" },
        },
      ],
    },
    {
      name: "Remove unknown Parameter",
      code: `
            const Page = ({ params }: { params: { slugTypo: string } }) => {
              return <div>commentary</div>;
            }
            export default Page;
            `,
      output: `
            const Page = ({ params }: { params: { slug: string } }) => {
              return <div>commentary</div>;
            }
            export default Page;
            `,
      filename: "src/app/movies/[slug]/page.tsx",
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "slugTypo" },
        },
      ],
    },
    {
      name: "Remove unknown Parameter in TSTypeLiteral (1/3)",
      code: `const Page = ({
        params: { userId },
      }: {
        params: { userId: string; lawl: string };
      }) => {
        return (<div>Hallo</div>)
      };

      export default Page;
              `,
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "lawl" },
        },
      ],
      filename: "src/app/movies/[userId]/page.tsx",
      output: `const Page = ({
        params: { userId },
      }: {
        params: { userId: string };
      }) => {
        return (<div>Hallo</div>)
      };

      export default Page;
              `,
    },
    {
      name: "Remove unknown Parameter in TSTypeLiteral (2/3)",
      code: `
            function Page  ({
        params: { userId },
      }: {
        params: { userId: string; reviewId: string };
      })  {
        return null;
      };
      export default Page;`,
      filename: "src\\app\\movies\\[userId]\\page.tsx",
      output: `
            function Page  ({
        params: { userId },
      }: {
        params: { userId: string };
      })  {
        return null;
      };
      export default Page;`,
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "reviewId" },
        },
      ],
    },
    {
      name: "Remove unknown Parameter in TSTypeLiteral (3/3)",
      code: `
            const Page = ({
        params: { userId },
      } : { params: { userId: string; reviewId: string }}) =>  {
        return null;
      };
      export default Page;`,
      filename: "src\\app\\movies\\[userId]\\page.tsx",
      output: `
            const Page = ({
        params: { userId },
      } : { params: { userId: string }}) =>  {
        return null;
      };
      export default Page;`,
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "reviewId" },
        },
      ],
    },
    {
      name: "Replace param as dynamic Params with catchAll-Params in TSTypeReference",
      code: `function Page(parameters: { params: { id: string, other: string} }) {
              return  null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: { id: string, other: string[]} }) {
              return  null;
            }
            export default Page;
            `,
      errors: [
        {
          messageId: "issue:isWrongParameterType",
          data: { name: "other", type: "string[]" },
        },
      ],
      filename: "src/app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: "Replace type of param (TSTypeLiteral) in TSTypeReference with catchAll-param",
      code: `function Page(parameters: { params: { ids: number }}) {
              return null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: { ids: string[] }}) {
              return null;
            }
            export default Page;
            `,
      errors: [
        {
          messageId: "issue:isWrongParameterType",
          data: { name: "ids", type: "string[]" },
        },
      ],
      filename: "src/app/movies/[...ids]/page.tsx",
    },
    {
      name: "Replace type of param (number) in TSTypeReference with catchAll-param",
      code: `function Page(parameters: { params: { id: null, other: {hallo : 2} }}) {
              return  null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: { id: string, other: string[] }}) {
              return  null;
            }
            export default Page;
            `,
      filename: "src/app/movies/[id]/[...other]/layout.tsx",
      errors: [
        {
          messageId: "issue:isWrongParameterType",
          data: { name: "id", type: "string" },
        },
        {
          messageId: "issue:isWrongParameterType",
          data: { name: "other", type: "string[]" },
        },
      ],
    },
    {
      name: "Replace unknown parameter in TSTypeReference",
      code: `function Page(parameters: { params: { otherTypo: string[] }}) {
              return  null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: { other: string[] }}) {
              return  null;
            }
            export default Page;
            `,
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "otherTypo" },
        },
      ],
      filename: "src/app/[...other]/layout.tsx",
    },
    {
      name: "Remove forbidden PropertyKey in TSTypeReference",
      code: `
            type Params = { losterKey: any};
            export default function Page(paramters : Params){return <></>;}`,
      output: `
            type Params = { };
            export default function Page(paramters : Params){return <></>;}`,
      errors: [
        {
          messageId: "issue:forbiddenPropertyKey",
          data: { key: "losterKey" },
        },
      ],
      filename: "src/app/movies/[id]/page.tsx",
    },
    {
      name: `The correct type of searchParams ${correctSearchParamsTypeAnnotation} is validated`,
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams: { [key: string]: string | string[] | number } }) {
              return  null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: { id: string, other: string[]}, searchParams${correctSearchParamsTypeAnnotation} }) {
              return  null;
            }
            export default Page;
            `,
      errors: [
        {
          messageId: "issue:wrong-searchParams-type",
        },
      ],
      filename: "src/app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: `The correct type of searchParams ${correctSearchParamsTypeAnnotation} is validated`,
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams: number }) {
              return  null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: { id: string, other: string[]}, searchParams${correctSearchParamsTypeAnnotation} }) {
              return  null;
            }
            export default Page;
            `,
      errors: [
        {
          messageId: "issue:wrong-searchParams-type",
        },
      ],
      filename: "src/app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: "The generateStaticParams function must return an array of objects with the correct type",
      code: `const generateStaticParams = function(parameters : {params : { id : string}}): { id: string; reviewId?: string} {return { id: "hallo"}}`,
      output: `const generateStaticParams = function(parameters : {params : { id : string}}): {
    reviewId?: string;
    id: string;
}[] {return { id: "hallo"}}`,
      errors: [
        {
          messageId: "issue:wrong-returntype",
        },
      ],
      filename: "src/app/movies/[reviewId]/[id]/page.tsx",
    },
    {
      name: "generateStaticParams as funtion works",
      code: `function generateStaticParams(){
      return []
      }`,
      output: `function generateStaticParams(): {
    id: string;
}[]{
      return []
      }`,
      filename: "src/app/movies/[id]/page.tsx",
      errors: [
        {
          messageId: "issue:no-returntype",
        },
      ],
    },
    {
      name: "generateStaticParams as arrow function replaces keys of returntype of 'nick' with 'id' ",
      code: `export const generateStaticParams = () : { nick: string }[] => []`,
      output: `export const generateStaticParams = () : {
    id: string;
}[] => []`,
      filename: "src/app/movies/[id]/page.tsx",
      errors: [
        {
          messageId: "issue:unknown-parameter",
        },
      ],
    },
    {
      name: "generateStaticParams as arrow function misses current route param",
      code: `export const generateStaticParams = () : {optionalFirst: string, optionalSecond: string }[] => []`,
      output: `export const generateStaticParams = () : {
    optionalFirst?: string;
    optionalSecond?: string;
    id: string;
}[] => []`,
      filename: "src/app/movies/[optionalFirst]/[optionalSecond]/[id]/page.tsx",
      errors: [
        {
          messageId: "issue:isNoOptionalParam",
          data: { name: "id" },
        },
      ],
    },
    {
      name: "generateStaticParams as arrow function is not allowed to have current route param as optional",
      code: `export const generateStaticParams = () : {optionalFirst?: string, optionalSecond?: string, id?: string }[] => []`,
      output: `export const generateStaticParams = () : {
    optionalFirst?: string;
    optionalSecond?: string;
    id: string;
}[] => []`,
      filename: "src/app/movies/[optionalFirst]/[optionalSecond]/[id]/page.tsx",
      errors: [
        {
          messageId: "issue:isNoOptionalParam",
          data: { name: "id" },
        },
      ],
    },
    {
      name: "generateMetadata as arrow function is not allowed to have current route param as optional",
      code: `export const generateMetadata  = ( props: { params : { id:number}} ) => []`,
      output: `export const generateMetadata  = ( props: { params : { id:string}} ) => []`,
      filename: "src/app/movies/[optionalFirst]/[optionalSecond]/[id]/page.tsx",
      errors: [
        {
          messageId: "issue:isWrongParameterType",
        },
      ],
    },
  ],
} satisfies RunTests<
  InferMessageIdsTypeFromRule<typeof rule>,
  InferOptionsTypeFromRule<typeof rule>
>;

const validtestFiles = allCases.valid.map(({ filename }) => filename);
const invalidTestFiles = allCases.invalid.map(({ filename }) => filename);
const allTestFiles = [...new Set([...validtestFiles, ...invalidTestFiles])];

describe("Your ESLint Rule", () => {
  beforeAll(() => {
    allTestFiles.forEach((testFilename) => {
      const fileAlreadyExists = fs.existsSync(testFilename);
      const directory = path.dirname(testFilename);
      const directoriesExistedBeforeTest = fs.existsSync(directory);

      if (!directoriesExistedBeforeTest) {
        fs.mkdirSync(directory, { recursive: true });
      }
      if (!fileAlreadyExists) {
        fs.writeFileSync(testFilename, "");
      }
    });
  });

  afterAll(() => {
    const appDirectory = path.join(__dirname, "../app");

    if (fs.existsSync(appDirectory)) {
      fs.rmSync(appDirectory, { recursive: true, force: true });
    }
  }),
    ruleTester.run("enforce-route-params", rule, allCases);
});
