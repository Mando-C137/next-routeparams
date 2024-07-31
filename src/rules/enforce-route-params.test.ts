import { RuleTester } from "@typescript-eslint/rule-tester";
import { enforceRouteParamsRule } from "./enforce-route-params";
import { createCorrectSearchParamsType } from "../utils/utils";

RuleTester.resetDefaultConfig();
const ruleTester = new RuleTester();

ruleTester.run("my-rule", enforceRouteParamsRule, {
  valid: [
    {
      name: "The params of the default exported function has all file-based parameter keys ",
      code: `export default async function ReviewPage(
               parameters
            : {
            params: { reviewId: string; id: string };
          }) {
          return null;
          }`,
      filename: "app/movies/[id]/[reviewId]/page.tsx",
    },
    {
      name: "The params of the default exported function has one of the file-based parameter keys ",
      code: "export default async function Page( parameters: { params: {id : string}}){return <div>Hallo</div>;}",
      filename: "app\\movies\\[id]\\[reviewId]\\page.tsx",
    },
    {
      name: "The default exported function has no function parameters",
      code: "export default function Page(){return <></>;}",
      filename: "app/movies/[id]/[reviewId]/page.tsx",
    },
    {
      name: "The default exported function's parameter are defined as a TypeReference within the file",
      code: `
      type Params = { params : { ker: string }};
      export default function Page(paramters : Params){return <></>;}`,
      filename: "app/movies/[id]/[ker]/page.tsx",
    },
    {
      code: `
      export default function Page(parameters: { params: { id: string}, searchParams: { [key: string]: string | string[] | undefined } }) {
      return null;}`,
      filename: "app/movies/[id]/[reviewId]/page.tsx",
    },

    {
      name: "A function which is later default exported is validated as the route compoenent",
      code: `export const generateMetadata = (parameters : { params : {id: string}}) => null;
      function Lawl(){
        return  null;
      }
      export default Lawl;
      `,
      filename: "app/movies/[id]/page.tsx",
    },
    {
      name: "A function which is later default exported has the correct paramter type",
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams: { [key: string]: string | string[] | undefined } }) {
        return  null;
      }
      export default Page;
      `,
      filename: "app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: ` The correct type of searchParams is validated`,
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams${createCorrectSearchParamsType()} }) {
        return  null;
      }
      export default Page;
      `,
      filename: "app/movies/[id]/[...other]/page.tsx",
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
      filename: "app/movies/[id]/[reviewId]/page.tsx",
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
      filename: "app/movies/[id]/[reviewId]/page.tsx",
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
      filename: "app/movies/[id]/[reviewId]/page.tsx",
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
      filename: "app/movies/[id]/[reviewId]/page.tsx",
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
      filename: "app/movies/[id]/[reviewId]/page.tsx",
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
      filename: "app/page.tsx",
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
      filename: "app/movies/[slug]/page.tsx",
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
      filename: "app/movies/[userId]/page.tsx",
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
      filename: "app\\movies\\[userId]\\page.tsx",
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
        { messageId: "issue:unknown-parameter", data: { name: "reviewId" } },
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
      filename: "app\\movies\\[userId]\\page.tsx",
      output: `
      const Page = ({
  params: { userId },
} : { params: { userId: string }}) =>  {
  return null;
};
export default Page;`,
      errors: [
        { messageId: "issue:unknown-parameter", data: { name: "reviewId" } },
      ],
    },
    {
      name: "Replace param as dynammic Params with catchAll-Params in TSTypeReference",
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
      filename: "app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: "Replace type of param (TSTypeLiteral) in TSTypeReference with catchAll-param",
      code: `function Page(parameters: { params: { ids: number }}) {
        return  null;
      }
      export default Page;
      `,
      output: `function Page(parameters: { params: { ids: string[] }}) {
        return  null;
      }
      export default Page;
      `,
      errors: [
        {
          messageId: "issue:isWrongParameterType",
          data: { name: "ids", type: "string[]" },
        },
      ],
      filename: "app/movies/[...ids]/page.tsx",
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
      filename: "app/movies/[id]/[...other]/layout.tsx",
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
        { messageId: "issue:unknown-parameter", data: { name: "otherTypo" } },
      ],
      filename: "app/[...other]/layout.tsx",
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
      filename: "app/movies/[id]/page.tsx",
    },
    {
      name: ` The correct type of searchParams(${createCorrectSearchParamsType()}) is validated`,
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams: { [key: string]: string | string[] | number } }) {
        return  null;
      }
      export default Page;
      `,
      output: `function Page(parameters: { params: { id: string, other: string[]}, searchParams${createCorrectSearchParamsType()} }) {
        return  null;
      }
      export default Page;
      `,
      errors: [
        {
          messageId: "issue:wrong-searchParams-type",
        },
      ],
      filename: "app/movies/[id]/[...other]/page.tsx",
    },
    {
      name: `The correct type of searchParams(${createCorrectSearchParamsType()}) is validated`,
      code: `function Page(parameters: { params: { id: string, other: string[]}, searchParams: number }) {
        return  null;
      }
      export default Page;
      `,
      output: `function Page(parameters: { params: { id: string, other: string[]}, searchParams${createCorrectSearchParamsType()} }) {
        return  null;
      }
      export default Page;
      `,
      errors: [
        {
          messageId: "issue:wrong-searchParams-type",
        },
      ],
      filename: "app/movies/[id]/[...other]/page.tsx",
    },
  ],
});
