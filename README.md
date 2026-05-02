# eslint-plugin-next-route-params

This ESLint plugin ensures that only the correct parameters are used in Next.js App Router routes based on the file-based routing system. It validates `params`, `searchParams`, and enforces the use of Next.js helper types (`PageProps`, `LayoutProps`, `RouteContext`) for type-safe route parameters.

<a href="https://www.npmjs.com/package/eslint-plugin-next-route-params" target="\_parent">
  <img alt="" src="https://img.shields.io/npm/dm/eslint-plugin-next-route-params.svg" />

## Installation

To use this plugin, you need to have ESLint installed. You can install ESLint and the plugin using npm, pnpm, or yarn:

```bash
npm install eslint eslint-plugin-next-route-params --save-dev
# or
pnpm add eslint eslint-plugin-next-route-params --save-dev
# or
yarn add eslint eslint-plugin-next-route-params --dev
```

## Usage

This plugin supports ESLint flat config. Add it to your `eslint.config.mjs`:

```js
import nextRouteParams from "eslint-plugin-next-route-params";

export default [
  // ... your other configs
  {
    plugins: {
      "next-route-params": nextRouteParams,
    },
    rules: {
      "next-route-params/enforce-route-params": [
        "error",
        { helperTypes: true },
      ],
    },
  },
];
```

## Rule Details

The `next-route-params/enforce-route-params` rule checks that only the correct parameters are used in your Next.js routes. This rule uses the file-based routing system of Next.js to determine the allowed parameters for each route.

<!-- begin auto-generated rules list -->

🔧 Automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/user-guide/command-line-interface#--fix).

| Name                                                       | Description                                                          | 🔧  |
| :--------------------------------------------------------- | :------------------------------------------------------------------- | :-- |
| [enforce-route-params](docs/rules/enforce-route-params.md) | enforce correct route parameters built by Next.js' file based routes | 🔧  |

<!-- end auto-generated rules list -->

### Options

| Name           | Type      | Default | Description                                                                                                                                                   |
| :------------- | :-------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `searchParams` | `boolean` | `true`  | If true, also strictly validates `searchParams` and enforces that it is of type `Promise<{ [key: string]: string \| string[] \| undefined }>`                 |
| `helperTypes`  | `boolean` | `false` | If true, enforces the use of Next.js helper types (`PageProps`, `LayoutProps`, `RouteContext`) instead of inline type annotations for page/layout/route files |

### Examples

Given the following file structure:

```
app/
├── page.tsx
├── layout.tsx
├── blog/
│   ├── [slug]/
│   │   ├── page.tsx
│   │   └── layout.tsx
│   └── category/
│       └── [post]/
│           └── page.tsx
└── api/
    └── [id]/
        └── route.ts
```

#### With `helperTypes: false` (default)

The following are considered **errors** and will be auto-fixed:

```tsx
// app/blog/[slug]/page.tsx
// ❌ 'category' is not a valid parameter for this page
export default function Blog({
  params,
}: {
  params: Promise<{ slug: string; category: string }>;
}) {
  return <div>{slug}</div>;
}
```

The following are considered **correct**:

```tsx
// app/blog/[slug]/page.tsx
// ✅ Only 'slug' is a valid parameter for this page
export default async function Blog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <div>{slug}</div>;
}
```

#### With `helperTypes: true`

When `helperTypes` is enabled, the rule enforces the use of Next.js helper types. The following are considered **errors** and will be auto-fixed:

```tsx
// app/blog/[slug]/page.tsx
// ❌ Inline type annotation is not allowed
export default async function Blog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <div>{slug}</div>;
}
```

The following are considered **correct**:

```tsx
// app/blog/[slug]/page.tsx
// ✅ Uses PageProps with the correct route path
export default async function Blog({ params }: PageProps<"/blog/[slug]\">) {
  const { slug } = await params;
  return <div>{slug}</div>;
}
```

```tsx
// app/blog/[slug]/layout.tsx
// ✅ Uses LayoutProps with the correct route path
export default function BlogLayout({ children }: LayoutProps<"/blog/[slug]\">) {
  return <div>{children}</div>;
}
```

```tsx
// app/api/[id]/route.ts
// ✅ Uses RouteContext with the correct route path
export async function GET(_req: Request, { params }: RouteContext<"/api/[id]\">) {
  const { id } = await params;
  return Response.json({ id });
}
```

#### generateMetadata

`generateMetadata` also uses `PageProps` when `helperTypes` is enabled:

```tsx
// app/blog/[slug]/page.tsx
// Uses PageProps for generateMetadata
export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]\">): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}
```

#### generateStaticParams

`generateStaticParams` receives parent route params and returns all-optional params:

```tsx
// app/blog/[slug]/page.tsx
// Params use parent route PageProps, return type is all-optional
export async function generateStaticParams({
  params,
}: {
  params?: Awaited<Omit<PageProps<"/blog\">, "searchParams">["params"]>;
}): Promise<Array<{ slug?: string }>> {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}
```

#### Supported file conventions

| File convention | Helper type    | Notes                                           |
| :-------------- | :------------- | :---------------------------------------------- |
| `page.tsx`      | `PageProps`    | Receives `params` and optionally `searchParams` |
| `layout.tsx`    | `LayoutProps`  | Receives `params` and `children`                |
| `default.tsx`   | `LayoutProps`  | Parallel route fallback, receives `params`      |
| `route.ts`      | `RouteContext` | Route handler, receives `params` on second arg  |

## Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have any suggestions or improvements.

## License

This project is licensed under the MIT License.
