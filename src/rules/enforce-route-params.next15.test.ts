import path from "path";
import type { PackageJson } from "type-fest";
import { createTester } from "./testdata";
import type fs from "fs";
import type { RunTests } from "@typescript-eslint/rule-tester";
import type { MessageIds, Options } from "./enforce-route-params";

jest.mock("fs", () => {
  const actualFs = jest.requireActual<typeof fs>("fs");
  return {
    ...actualFs,
    readFileSync: jest.fn((filePath, options) => {
      if (filePath === path.join(process.cwd(), "package.json")) {
        return JSON.stringify({
          dependencies: { next: "^15.0.3" },
        } satisfies PackageJson);
      }
      return actualFs.readFileSync(filePath, options);
    }) as typeof fs.readFileSync,
    existsSync: jest.fn((filePath) => {
      if (filePath === path.join(process.cwd(), "package.json")) {
        return true;
      }
      return actualFs.existsSync(filePath);
    }) as typeof fs.existsSync,
  };
});

const allTestFiles = {
  valid: [
    {
      name: "lawl",
      code: `
export default function Page(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return null
}`,
      filename: path.join("src", "app", "page.tsx"),
    },
    {
      name: "generateStaticParams allows returntype of one param 'id' is working",
      code: `export const generateStaticParams = () : {id: string }[] => []`,
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
    },
    {
      name: "The params of the default exported function has all file-based parameter keys ",
      code: `export default async function ReviewPage(
                     parameters
                  : {
                  params: Promise<{ reviewId: string; id: string }>;
                }) {
                return null;
                }

                export const generateStaticParams = async function(parameters : {params : { id : string}}): Promise<{ id?: string; reviewId: string}[]> {
                  return null;
              }
                `,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
    },
    {
      name: "The params of the default exported function has one of the file-based parameter keys ",
      code: "export default async function Page( parameters: { params: Promise<{id : string}>}){return <div>Hallo</div>;}",
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
    },
    {
      name: "The default exported function has no function parameters",
      code: "export default function Page(){return <></>;}",
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
    },
    {
      name: "The default exported function's parameter are defined as a TypeReference within the file",
      code: `
            type Params = { params : Promise<{ ker: string }>};
            export default function Page(parameters : Params){return <></>;}`,
      filename: path.join("src", "app", "movies", "[id]", "[ker]", "page.tsx"),
    },
    {
      code: `
            export default function Page(parameters: { params: Promise<{ id: string}>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
            return null;}`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
    },

    {
      name: "A function which is later default exported is validated as the route compoenent",
      code: `export const generateMetadata = (parameters : { params : Promise<{id: string}>}) => null;
            function Lawl(){
              return  null;
            }
            export default Lawl;
            `,
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
    },
    {
      name: "A function which is later default exported has the correct parameter type",
      code: `function Page(parameters: { params: Promise<{ id: string, other: string[]}>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
              return  null;
            }
            export default Page;
            `,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: "searchParams also allows Array<string> instead of string[]",
      code: `function Page(parameters: { params: Promise<{ id: string, other: string[]}>, searchParams: Promise<{ [lol: string]: string | Array<string> | undefined }> }) {
              return  null;
            }
            export default Page;
            `,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: `The correct type of searchParams is validated`,
      code: `function Page(parameters: {
  params: Promise<{ id: string; other: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return null;
}
export default Page;`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: "A correct params type for generateMetadata is validated",
      code: `export function generateMetadata(parameters :
      { params: Promise<{ id: string, other: string[] }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) { return null; } `,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: "Returning a Promise from generateStaticParams is allowed",
      code: `export const generateStaticParams = async function (): Promise<
      { id?: string; other: string[] }[]
    > {
        return [{ other: ["hallo"] }];
    };`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: `searchParams is not validated if it is set to false in options`,
      code: `
            function Page(parameters: { searchParams: Promise<{ sort: "asc" | "desc" }> }) {
              return null;
            }
            export default Page;
      `,
      options: [{ searchParams: false }],
      filename: path.join("src", "app", "page.tsx"),
    },
    {
      name: `layout file can have a children as Props`,
      code: `
            function Layout(parameters: {children: React.ReactNode}
            ) {
              return null;
            }
            export default Layout;
      `,
      options: [{ searchParams: false }],
      filename: path.join("src", "app", "layout.tsx"),
    },
    {
      name: "It can also find Params in Promise that are is ReferencedType",
      code: `
type Params= { id: string };
export default async function ReviewsForMoviePage(
  props: { params: Promise<Params> }
) {
  const params = await props.params;
  return params.id;
}`,
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
    },
  ],
  invalid: [
    {
      name: "Replace wrong parameter type of route-param in TSTypeLiteral",
      code: `
            export default async function Page(parameters: { params: Promise<{ id: number }> }) {
              return <div>Hallo</div>;
            }
            `,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
      output: `
            export default async function Page(parameters: { params: Promise<{ id: string }> }) {
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
            export default function Page(parameters: { params: Promise<{ ids: number }> }) {
              return <></>;
            }
            `,
      output: `
            export default function Page(parameters: { params: Promise<{
    id: string;
    reviewId: string;
}> }) {
              return <></>;
            }
            `,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
      errors: [{ messageId: "issue:unknown-parameter", data: { name: "ids" } }],
    },
    {
      name: "Replace type params and keep searchParams in TSTypeLiteral",
      code: `
            export default function Page(parameters: { params: Promise<{ idBang: string }>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
            return null;}`,
      output: `
            export default function Page(parameters: { params: Promise<{
    id: string;
    reviewId: string;
}>, searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
            return null;}`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
      errors: [
        { messageId: "issue:unknown-parameter", data: { name: "idBang" } },
      ],
    },
    {
      name: "Remove unknown Parameter and add known paramter in TSTypeLiteral (1/2)",
      code: `
            export default function Page(parameters : { params : Promise<{iasd: string, id: string }>}){return <></>;}`,
      output: `
            export default function Page(parameters : { params : Promise<{
    id: string;
    reviewId: string;
}>}){return <></>;}`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
      errors: [
        { messageId: "issue:unknown-parameter", data: { name: "iasd" } },
      ],
    },
    {
      name: "Remove unknown Parameter and add known paramter in TSTypeLiteral (2/2)",
      code: `export default async function ReviewPage(
                  parameters
            : {
              params: Promise<{ reviewId: string, idasdfasdf: string }>;
            }) {
              return null;
            }`,
      output: `export default async function ReviewPage(
                  parameters
            : {
              params: Promise<{
    id: string;
    reviewId: string;
}>;
            }) {
              return null;
            }`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[reviewId]",
        "page.tsx",
      ),
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
              params: Promise<{ reviewId: string; idasdfasdf: string }>;
            }) {
              return null;
            }`,
      output: `
            export default async function ReviewPage({}: {
              params: Promise<Record<string, never>>;
            }) {
              return null;
            }`,
      filename: path.join("src", "app", "page.tsx"),
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
            const Page = ({ params } : { params: Promise<{ slugTypo: string }> }) => {
              return <div>commentary</div>;
            }
            export default Page;
            `,
      output: `
            const Page = ({ params } : { params: Promise<{
    slug: string;
}> }) => {
              return <div>commentary</div>;
            }
            export default Page;
            `,
      filename: path.join("src", "app", "movies", "[slug]", "page.tsx"),
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
        params
      }: {
        params: Promise<{
    userId: string;
    lawl: string
}>
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
      filename: path.join("src", "app", "movies", "[userId]", "page.tsx"),
      output: `const Page = ({
        params
      }: {
        params: Promise<{
    userId: string;
}>
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
        params
      }: {
        params: Promise<{
   userId: string;
   reviewId: string
}>;
      })  {
        return null;
      };
      export default Page;`,
      filename: path.join("src", "app", "movies", "[userId]", "page.tsx"),
      output: `
            function Page  ({
        params
      }: {
        params: Promise<{
    userId: string;
}>;
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
        params
      } : { params: Promise<{
    userId: string;
    reviewId: string
}>}) =>  {
        return null;
      };
      export default Page;`,
      filename: path.join("src", "app", "movies", "[userId]", "page.tsx"),
      output: `
            const Page = ({
        params
      } : { params: Promise<{
    userId: string;
}>}) =>  {
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
      code: `function Page(parameters: { params: Promise<{ id: string, other: string}> }) {
              return  null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: Promise<{ id: string, other: string[]}> }) {
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
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: "Replace type of param (TSTypeLiteral) in TSTypeReference with catchAll-param",
      code: `function Page(parameters: { params: Promise<{ ids: number }> }) {
              return null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: Promise<{ ids: string[] }> }) {
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
      filename: path.join("src", "app", "movies", "[...ids]", "page.tsx"),
    },
    {
      name: "Replace type of param (number) in TSTypeReference with catchAll-param",
      code: `function Page(parameters: { params: Promise<{ id: null, other: {hallo : 2} }> }) {
              return  null;
            }
            export default Page;
            `,
      output: `function Page(parameters: { params: Promise<{ id: string, other: string[] }> }) {
              return  null;
            }
            export default Page;
            `,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "layout.tsx",
      ),
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
      code: `
      function Page(parameters: { params: Promise<{ otherTypo: string[] }> }) {
              return  null;
            }
            export default Page;
            `,
      output: `
      function Page(parameters: { params: Promise<{
    other: string[];
}> }) {
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
      filename: path.join("src", "app", "[...other]", "layout.tsx"),
    },
    {
      name: "Remove forbidden PropertyKey in TSTypeReference",
      code: `
            type Params = { losterKey: any};
            export default function Page(parameters : Params){return <></>;}`,
      output: `
            type Params = { };
            export default function Page(parameters : Params){return <></>;}`,
      errors: [
        {
          messageId: "issue:forbiddenPropertyKey",
          data: { key: "losterKey" },
        },
      ],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
    },
    {
      name: `The type of searchParams is validated`,
      code: `function Page(parameters: { params: Promise<{ id: string, other: string[]}>, searchParams: Promise<{ [key: string]: string | string[] | number }> }) {
              return  null;
            }
            export default Page;`,
      output: `function Page(parameters: { params: Promise<{ id: string, other: string[]}>, searchParams: Promise<{
    [key: string]: string | string[] | undefined;
}> }) {
              return  null;
            }
            export default Page;`,
      errors: [
        {
          messageId: "issue:wrong-searchParams-type",
        },
      ],
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: `The correct type of searchParams is validated`,
      code: `function Page(parameters: {
  params: Promise<{ id: string; other: string[] }>;
  searchParams: Promise<number>;
}) {
  return null;
}
export default Page;`,
      output: `function Page(parameters: {
  params: Promise<{ id: string; other: string[] }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
}>;
}) {
  return null;
}
export default Page;`,
      errors: [
        {
          messageId: "issue:wrong-searchParams-type",
        },
      ],
      filename: path.join(
        "src",
        "app",
        "movies",
        "[id]",
        "[...other]",
        "page.tsx",
      ),
    },
    {
      name: "The generateStaticParams function must return an array of objects with the correct type",
      code: `const generateStaticParams = function(parameters : {params : { id : string}}): { id: string; reviewId?: string} {return [{ id: "hallo"}]}`,
      output: `const generateStaticParams = function(parameters : {params : { id : string}}): {
    reviewId?: string;
    id: string;
}[]  {return [{ id: "hallo"}]}`,
      errors: [
        {
          messageId: "issue:wrong-returntype",
        },
      ],
      filename: path.join(
        "src",
        "app",
        "movies",
        "[reviewId]",
        "[id]",
        "page.tsx",
      ),
    },
    {
      name: "generateStaticParams as function adds missing return type",
      code: `function generateStaticParams(){
      return []
      }`,
      output: `function generateStaticParams(): {
    id: string;
}[] {
      return []
      }`,
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
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
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
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
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
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
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
      errors: [
        {
          messageId: "issue:isNoOptionalParam",
          data: { name: "id" },
        },
      ],
    },
    {
      name: "generateMetadata as arrow function is not allowed to have current route param as optional",
      code: `export const generateMetadata  = ( props: { params : Promise<{ id: number }>} ) => []`,
      output: `export const generateMetadata  = ( props: { params : Promise<{ id: string }>} ) => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
      errors: [
        {
          messageId: "issue:isWrongParameterType",
        },
      ],
    },

    {
      name: "generateStaticParams as arrow function corrects output of wrond return type",
      code: `export const generateStaticParams  = () : { id: number }[] => []`,
      output: `export const generateStaticParams  = () : { id: string }[] => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
      errors: [
        {
          messageId: "issue:isWrongParameterType",
        },
      ],
    },

    {
      name: "generateMetadata as arrow function adds missing return type",
      code: `export const generateStaticParams  = () => []`,
      output: `export const generateStaticParams  = () : {
    optionalFirst?: string;
    optionalSecond?: string;
    id: string;
}[] => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
      errors: [
        {
          messageId: "issue:no-returntype",
        },
      ],
    },
    {
      name: "generateStaticParams as arrow function adds missing return type",
      code: `export const generateStaticParams  = async () => []`,
      output: `export const generateStaticParams  = async () : Promise<{
    optionalFirst?: string;
    optionalSecond?: string;
    id: string;
}[]> => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
      errors: [
        {
          messageId: "issue:no-returntype",
        },
      ],
    },
    {
      name: "async generateStaticParams as arrow function corrects wrong return type",
      code: `export const generateStaticParams  = async (): Promise<{ id?: string }[]> => []`,
      output: `export const generateStaticParams  = async (): Promise<{
    optionalFirst?: string;
    optionalSecond?: string;
    id: string;
}[]> => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
      errors: [
        {
          messageId: "issue:isNoOptionalParam",
        },
      ],
    },
    {
      name: "async generateStaticParams as normal function corrects wrong return type",
      code: `export async function generateStaticParams(): Promise<{ id: number}[]> {return [];}`,
      output: `export async function generateStaticParams(): Promise<{ id: string}[]> {return [];}`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
      errors: [
        {
          messageId: "issue:isWrongParameterType",
        },
      ],
    },
    {
      name: "async generateStaticParams as normal function corrects wrong return type",
      code: `
export default async function ReviewsForMoviePage(
  props: {
    params: { id: string };
  }
) {
  const params = await props.params;
  return params.id;
}`,
      output: `
export default async function ReviewsForMoviePage(
  props: {
    params: Promise<{
    id: string;
}>;
  }
) {
  const params = await props.params;
  return params.id;
}`,
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
      errors: [
        {
          messageId: "issue:asyncRequestApi-params",
        },
      ],
    },
    {
      name: "GET - RouteHandler correct params",
      code: `
export const GET = (req, { params }: { params: Promise<{ wrong: string }> }) => {
  return NextResponse.json({ hello: "world" });
}`,
      output: `
export const GET = (req, { params }: { params: Promise<{
    id: string;
}> }) => {
  return NextResponse.json({ hello: "world" });
}`,
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "wrong" },
        },
      ],
      filename: path.join("src", "app", "[id]", "route.ts"),
    },
    {
      name: "GET - RouteHandler corrects params",
      code: `
export function GET(req, { params }: { params: Promise<{ wrong: string }> }) {
  return NextResponse.json({ hello: "world" });
}`,
      output: `
export function GET(req, { params }: { params: Promise<{
    id: string;
}> }) {
  return NextResponse.json({ hello: "world" });
}`,
      errors: [
        {
          messageId: "issue:unknown-parameter",
          data: { name: "wrong" },
        },
      ],
      filename: path.join("src", "app", "[id]", "route.ts"),
    },
  ],
} satisfies RunTests<MessageIds, Options>;

const tester = createTester(allTestFiles);
describe("enforce-route-params next 15", () => {
  beforeAll(tester.setUp);
  afterAll(tester.cleanUp);
  tester.runTests();
});
