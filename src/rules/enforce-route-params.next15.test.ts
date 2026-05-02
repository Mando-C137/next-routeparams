import path from "path";
import { beforeAll, afterAll, describe, vi } from "vitest";
import { createTester } from "./testdata";
import type { RunTests } from "@typescript-eslint/rule-tester";
import type { MessageIds, Options } from "./enforce-route-params";

vi.mock("../utils/readPackageJson", () => ({
  readPackageJson: vi.fn(() => ({
    dependencies: { next: "^15.0.3" },
  })),
}));

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
      options: [{ searchParams: false, helperTypes: false }],
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
      options: [{ searchParams: false, helperTypes: false }],
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
    {
      name: "PageProps helper type is allowed with helperTypes option",
      code: `export default async function Page(props: PageProps<'/movies/[id]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
    },
    {
      name: "LayoutProps helper type is allowed with helperTypes option",
      code: `export default function Layout(props: LayoutProps<'/movies/[id]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "layout.tsx"),
    },
    {
      name: "Optional catch-all params are validated correctly",
      code: `export default async function Page(parameters: { params: Promise<{ slug: string[] }> }) {
  return null;
}`,
      filename: path.join("src", "app", "blog", "[[...slug]]", "page.tsx"),
    },
    {
      name: "generateMetadata with PageProps helper type is allowed",
      code: `export function generateMetadata(parameters: PageProps<'/movies/[id]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
    },
    {
      name: "generateStaticParams with correct PageProps-derived params type is allowed",
      code: `export const generateStaticParams = ({ params }: { params?: Awaited<Omit<PageProps<'/movies/[id]'>, "searchParams">["params"]> }): { reviewId: string }[] => []`,
      options: [{ searchParams: true, helperTypes: true }],
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
      name: "generateStaticParams without params is allowed with helperTypes",
      code: `export const generateStaticParams = (): { id: string }[] => []`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
    },
    {
      name: "generateStaticParams as arrow function misses current route param",
      code: `export const generateStaticParams = () : {optionalFirst: string, optionalSecond: string }[] => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
    },
    {
      name: "generateStaticParams as arrow function is not allowed to have current route param as optional",
      code: `export const generateStaticParams = () : {optionalFirst?: string, optionalSecond?: string, id?: string }[] => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
    },
    {
      name: "async generateStaticParams as arrow function corrects wrong return type",
      code: `export const generateStaticParams  = async (): Promise<{ id?: string }[]> => []`,
      filename: path.join(
        "src",
        "app",
        "movies",
        "[optionalFirst]",
        "[optionalSecond]",
        "[id]",
        "page.tsx",
      ),
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
    id?: string;
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
    id?: string;
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
    id?: string;
}[] => []`,
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
      errors: [
        {
          messageId: "issue:unknown-parameter",
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
    id?: string;
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
    id?: string;
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
    {
      name: "Page with inline type is fixed to PageProps with helperTypes option",
      code: `
export default async function Page(parameters: { params: Promise<{ id: string }> }) {
  return <div>Hallo</div>;
}`,
      output: `
export default async function Page(parameters: PageProps<'/movies/[id]'>) {
  return <div>Hallo</div>;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
      errors: [
        {
          messageId: "issue:useHelperType",
          data: { helperType: "PageProps", routePath: "/movies/[id]" },
        },
      ],
    },
    {
      name: "Layout with inline type is fixed to LayoutProps with helperTypes option",
      code: `
export default function Layout(parameters: { params: Promise<{ id: string }>, children: React.ReactNode }) {
  return null;
}`,
      output: `
export default function Layout(parameters: LayoutProps<'/movies/[id]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "layout.tsx"),
      errors: [
        {
          messageId: "issue:useHelperType",
          data: { helperType: "LayoutProps", routePath: "/movies/[id]" },
        },
      ],
    },
    {
      name: "Route handler with inline type is fixed to RouteContext with helperTypes option",
      code: `
export async function GET(req: Request, { params }: { params: Promise<{ wrong: string }> }) {
  return Response.json({ hello: "world" });
}`,
      output: `
export async function GET(req: Request, { params }: RouteContext<'/[id]'>) {
  return Response.json({ hello: "world" });
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "[id]", "route.ts"),
      errors: [
        {
          messageId: "issue:useHelperType",
          data: { helperType: "RouteContext", routePath: "/[id]" },
        },
      ],
    },
    {
      name: "PageProps with wrong route path reports error and fixes",
      code: `
export default async function Page(props: PageProps<'/blog'>) {
  return null;
}`,
      output: `
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "blog", "[slug]", "page.tsx"),
      errors: [
        {
          messageId: "issue:wrong-helperType-path",
          data: {
            helperType: "PageProps",
            expectedPath: "/blog/[slug]",
            actualPath: "/blog",
          },
        },
      ],
    },
    {
      name: "LayoutProps with wrong route path reports error and fixes",
      code: `
export default function Layout(props: LayoutProps<'/wrong'>) {
  return null;
}`,
      output: `
export default function Layout(props: LayoutProps<'/dashboard'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "dashboard", "layout.tsx"),
      errors: [
        {
          messageId: "issue:wrong-helperType-path",
          data: {
            helperType: "LayoutProps",
            expectedPath: "/dashboard",
            actualPath: "/wrong",
          },
        },
      ],
    },
    {
      name: "RouteContext with wrong route path reports error and fixes",
      code: `
export async function GET(req: Request, ctx: RouteContext<'/[other]'>) {
  return Response.json({ id: (await ctx.params).id });
}`,
      output: `
export async function GET(req: Request, ctx: RouteContext<'/[id]'>) {
  return Response.json({ id: (await ctx.params).id });
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "[id]", "route.ts"),
      errors: [
        {
          messageId: "issue:wrong-helperType-path",
          data: {
            helperType: "RouteContext",
            expectedPath: "/[id]",
            actualPath: "/[other]",
          },
        },
      ],
    },
    {
      name: "PageProps with wrong route path in arrow function",
      code: `
const Page = (props: PageProps<'/about'>) => {
  return <div>About</div>;
}
export default Page;
`,
      output: `
const Page = (props: PageProps<'/about/team'>) => {
  return <div>About</div>;
}
export default Page;
`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "about", "team", "page.tsx"),
      errors: [
        {
          messageId: "issue:wrong-helperType-path",
          data: {
            helperType: "PageProps",
            expectedPath: "/about/team",
            actualPath: "/about",
          },
        },
      ],
    },
    {
      name: "generateMetadata with inline type is fixed to PageProps with helperTypes option",
      code: `
export function generateMetadata(parameters: { params: Promise<{ id: string }> }) {
  return null;
}`,
      output: `
export function generateMetadata(parameters: PageProps<'/movies/[id]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
      errors: [
        {
          messageId: "issue:useHelperType",
          data: { helperType: "PageProps", routePath: "/movies/[id]" },
        },
      ],
    },
    {
      name: "generateMetadata arrow function with inline type is fixed to PageProps with helperTypes option",
      code: `
export const generateMetadata = (parameters: { params: Promise<{ id: string }> }) => {
  return null;
}`,
      output: `
export const generateMetadata = (parameters: PageProps<'/movies/[id]'>) => {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
      errors: [
        {
          messageId: "issue:useHelperType",
          data: { helperType: "PageProps", routePath: "/movies/[id]" },
        },
      ],
    },
    {
      name: "generateMetadata with wrong PageProps path reports error and fixes",
      code: `
export function generateMetadata(parameters: PageProps<'/wrong'>) {
  return null;
}`,
      output: `
export function generateMetadata(parameters: PageProps<'/movies/[id]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "movies", "[id]", "page.tsx"),
      errors: [
        {
          messageId: "issue:wrong-helperType-path",
          data: {
            helperType: "PageProps",
            expectedPath: "/movies/[id]",
            actualPath: "/wrong",
          },
        },
      ],
    },
    {
      name: "generateStaticParams with inline params type is fixed to PageProps-derived type",
      code: `
export const generateStaticParams = ({ params }: { params: Promise<{ id: string }> }): { reviewId: string }[] => []`,
      output: `
export const generateStaticParams = ({ params }: { params?: Awaited<Omit<PageProps<'/movies/[id]'>, "searchParams">["params"]> }): { reviewId: string }[] => []`,
      options: [{ searchParams: true, helperTypes: true }],
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
          messageId: "issue:useHelperTypeForGenerateStaticParams",
          data: { routePath: "/movies/[id]" },
        },
      ],
    },
    {
      name: "generateStaticParams function with inline params type is fixed to PageProps-derived type",
      code: `
export function generateStaticParams({ params }: { params: Promise<{ id: string }> }): { reviewId: string }[] {
  return [];
}`,
      output: `
export function generateStaticParams({ params }: { params?: Awaited<Omit<PageProps<'/movies/[id]'>, "searchParams">["params"]> }): { reviewId: string }[] {
  return [];
}`,
      options: [{ searchParams: true, helperTypes: true }],
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
          messageId: "issue:useHelperTypeForGenerateStaticParams",
          data: { routePath: "/movies/[id]" },
        },
      ],
    },
    {
      name: "Optional catch-all param with wrong type is corrected",
      code: `
export default async function Page(parameters: { params: Promise<{ slug: string }> }) {
  return null;
}`,
      output: `
export default async function Page(parameters: { params: Promise<{ slug: string[] }> }) {
  return null;
}`,
      filename: path.join("src", "app", "blog", "[[...slug]]", "page.tsx"),
      errors: [
        {
          messageId: "issue:isWrongParameterType",
          data: { name: "slug", type: "string[]" },
        },
      ],
    },
    {
      name: "default.tsx with inline type is fixed to LayoutProps with helperTypes option",
      code: `
export default function Default(parameters: { params: Promise<{ id: string }> }) {
  return null;
}`,
      output: `
export default function Default(parameters: LayoutProps<'/dashboard/[id]'>) {
  return null;
}`,
      options: [{ searchParams: true, helperTypes: true }],
      filename: path.join("src", "app", "dashboard", "[id]", "default.tsx"),
      errors: [
        {
          messageId: "issue:useHelperType",
          data: { helperType: "LayoutProps", routePath: "/dashboard/[id]" },
        },
      ],
    },
  ],
} satisfies RunTests<MessageIds, Options>;

const tester = createTester(allTestFiles);
describe("enforce-route-params next 15", () => {
  beforeAll(tester.setUp);
  afterAll(tester.cleanUp);
  tester.runTests();
});
