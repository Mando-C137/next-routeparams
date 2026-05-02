# next-route-params/enforce-route-params

📝 Enforce correct route parameters built by Next.js' file based routes.

🔧 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix).

<!-- end auto-generated rule header -->

## Options

<!-- begin auto-generated rule options list -->

| Name           | Description                                                                                                                                                   | Type    | Choices         | Default |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------ | :-------------- | :------ |
| `helperTypes`  | If true, enforces the use of Next.js helper types (PageProps, LayoutProps, RouteContext) instead of inline type annotations for page, layout, and route files | Boolean | `true`, `false` | `false` |
| `searchParams` | If true, also strictly validates searchParams and enforces that the searchParams parameter is of type { [key: string]: string \| string[] \| undefined }      | Boolean | `true`, `false` | `true`  |

<!-- end auto-generated rule options list -->

### `searchParams`

Default: `true`

When enabled, the rule validates that the `searchParams` prop (if present) is of type `Promise<{ [key: string]: string | string[] | undefined }>` (Next.js 15+) or `{ [key: string]: string | string[] | undefined }` (Next.js 13/14).

### `helperTypes`

Default: `false`

When enabled, the rule enforces the use of Next.js helper types instead of inline type annotations:

- **`page.tsx`** → `PageProps<'/route/path'>`
- **`layout.tsx`** → `LayoutProps<'/route/path'>`
- **`default.tsx`** → `LayoutProps<'/route/path'>`
- **`route.ts`** → `RouteContext<'/route/path'>`

The route path is automatically derived from the file location within the `app/` directory. The rule also validates that the path inside the helper type matches the file's actual route path.

#### Auto-fix behavior

When `helperTypes: true`, the rule will automatically replace inline type annotations with the appropriate helper type:

```tsx
// Before (error)
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <div>{id}</div>;
}

// After auto-fix
export default function Page({ params }: PageProps<"/blog/[id]">) {
  return <div>{id}</div>;
}
```

#### `generateStaticParams` support

When `helperTypes: true`, `generateStaticParams` parameters are also enforced to use the parent route's `PageProps`:

```tsx
export async function generateStaticParams({
  params,
}: {
  params?: Awaited<Omit<PageProps<"/blog">, "searchParams">["params"]>;
}): Promise<Array<{ slug?: string }>> {
  // ...
}
```

#### `generateMetadata` support

`generateMetadata` functions use the current route's `PageProps`:

```tsx
export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  // ...
}
```
