# eslint-plugin-next-route-params

This ESLint plugin ensures that only the correct parameters are used in Next.js routes based on the file-based routing system. This is particularly useful in Next.js applications where route parameters are predefined and should be enforced at compile-time.

<a href="https://www.npmjs.com/package/eslint-plugin-next-route-params" target="\_parent">
  <img alt="" src="https://img.shields.io/npm/dm/eslint-plugin-next-route-params.svg" />

## Installation

To use this plugin, you need to have ESLint installed. You can install ESLint and the plugin using npm or yarn:

```bash
npm install eslint eslint-plugin-next-route-params --save-dev
# or
yarn add eslint eslint-plugin-next-route-params --dev
```

## Usage

Add `next-route-params` to the plugins section of your ESLint configuration file (e.g., `.eslintrc.json`):

```json
{
  "plugins": ["next-route-params"],
  "rules": {
    "next-route-params/enforce-route-params": "error"
  }
}
```

## Rule Details

The `next-route-params/validate-params` rule checks that only the correct parameters are used in your Next.js routes. This rule uses the file-based routing system of Next.js to determine the allowed parameters for each route.

### Options

This rule does not take any options.

### Examples

Given the following file structure:

```
app/
├── home
│   ├ route.tsx
├── blog
│      ├──[id]
│      |    ├──page.tsx
│      └── [category]
│               └── [post]
│                     └──page.tsx
```

The following are considered warnings/errors:

```tsx
//app/blog/[id]/page.tsx
export default function Blog({
  params: { id, category },
}: {
  params: {
    id: string;
    category: string;
  };
}) {
  // 'category' is not a valid parameter for this page
  return (
    <div>
      {category}-{id}
    </div>
  );
}
```

The following are considered correct:

```tsx
// app/blog/[id]/page.tsx
export default function Blog({ params: { id } }: { params: { id: string } }) {
  // 'id' is a valid parameter for this page
  return <div>{id}</div>;
}
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request if you have any suggestions or improvements.

## License

This project is licensed under the MIT License.
