import path, { posix } from "path";
import fs from "fs";
import type { PackageJson } from "type-fest";
import * as semVer from "semver";
import {
  ALLOWED_PROPS_FOR_LAYOUT,
  ALLOWED_PROPS_FOR_PAGE,
  PARAMS_PROP_NAME,
} from "./constants";

const toPosixPath = (p: string) => p.split(path.sep).join(posix.sep);

const getFilePathToPosix = (filename: string) => {
  // const pathFromRoot = path.dirname(context.filename);
  return toPosixPath(path.dirname(filename));
};

/**
 *
 * @param dirname the dirname containing the folders, the separator must be "/"
 * @returns true if a folder named "app" is found
 */
function appRouterFolderExists(dirname: string): boolean {
  return dirname.split(posix.sep).includes("app");
}

export type FilebasedParams = {
  catchAll: boolean;
  name: string;
  current: boolean;
}[];
/**
 *
 *
 * @param dirname the dirname containing the folders, the separator must be "/"
 * @returns a list of the dynamic parameters and if if they are catch all parameters
 */
function readFileBasedParameters(dirname: string): FilebasedParams {
  const folders = dirname.split(posix.sep);

  const appPosition = folders.findIndex((folder) => folder === "app");
  if (appPosition === -1) {
    return [];
  }
  const result = folders
    .filter((folder) => folder.startsWith("[") && folder.endsWith("]"))
    .map((folder) => {
      const catchAll = folder.startsWith("[...");
      const name = folder.slice(catchAll ? 4 : 1, -1);
      return { catchAll, name, current: false };
    });

  const lastFolderName = folders[folders.length - 1];
  if (lastFolderName?.endsWith("]")) {
    result[result.length - 1]!.current = true;
  }

  return result;
}

/**
 *
 * @param filename the filename containing the folders
 * @returns true if the filename is one of Next.js' app router files that accecpt paramaters ({@link https://nextjs.org/docs/app/api-reference/file-conventions})
 */
function isAppRouterFile(filename: FileNameType): boolean {
  return filename !== null;
}

type FileNameType = ReturnType<typeof getFilenameType>;

const FileNameTypeToAllowedPropsMap: Record<
  Exclude<FileNameType, null>,
  Array<string>
> = {
  default: [PARAMS_PROP_NAME],
  layout: [...ALLOWED_PROPS_FOR_LAYOUT],
  page: [...ALLOWED_PROPS_FOR_PAGE],
  route: [PARAMS_PROP_NAME],
};

export function getFileInfo(filename: string) {
  const parsedPath = path.parse(filename);
  const dirname = getFilePathToPosix(filename);
  const fileNameType = getFilenameType(parsedPath.name);
  return {
    isAppRouterFile: isAppRouterFile(fileNameType),
    appRouterFilename: fileNameType,
    inInAppRouterFolder: appRouterFolderExists(dirname),
    params: readFileBasedParameters(dirname),
    asyncRequestAPI: isAsyncRequestAPI(),
    allowedPropsForFileNameType: fileNameType
      ? FileNameTypeToAllowedPropsMap[fileNameType]
      : null,
  };
}

function getFilenameType(
  filename: string,
): "page" | "layout" | "default" | "route" | null {
  switch (path.parse(filename).name) {
    case "page":
      return "page";
    case "layout":
      return "layout";
    case "default":
      return "default";
    case "route":
      return "route";
    default:
      return null;
  }
}

function isAsyncRequestAPI() {
  const packageJson = readPackageJson();
  if (!packageJson) {
    return null;
  }
  const nextDependency = packageJson.dependencies?.next;
  if (!nextDependency) {
    return null;
  }
  const minVersion = semVer.minVersion(nextDependency);
  if (!minVersion) {
    return null;
  }
  const nextVersion = semVer.major(minVersion);
  if (!nextVersion) {
    return null;
  }

  const isNotAsycRequestAPI = nextVersion > 12 && nextVersion < 14;
  const isAsycRequestAPI = nextVersion > 14;

  if (isNotAsycRequestAPI) {
    return false;
  }
  if (isAsycRequestAPI) {
    return true;
  }
  return null;
}

function readPackageJson() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageJson;
}
