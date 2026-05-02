import fs from "fs";
import path from "path";
import type { PackageJson } from "type-fest";

export function readPackageJson(): PackageJson | null {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageJson;
}
