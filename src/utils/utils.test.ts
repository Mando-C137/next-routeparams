import { describe, expect, it, vi } from "vitest";
import { getFileInfo, getRoutePath, getParentRoutePath } from "./fs";
import {
  ALLOWED_PROPS_FOR_LAYOUT,
  ALLOWED_PROPS_FOR_PAGE,
  PARAMS_PROP_NAME,
} from "./constants";
import { readPackageJson } from "./readPackageJson";

describe("readPackageJson", () => {
  it("should read the package.json from cwd", () => {
    const result = readPackageJson();
    expect(result).not.toBeNull();
  });

  it("should return null when package.json does not exist", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/nonexistent/path");
    const result = readPackageJson();
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("getFileInfo", () => {
  it("should return an empty array if the file is not an app router file", () => {
    expect(getFileInfo("app/layout.tsx")).toEqual<
      ReturnType<typeof getFileInfo>
    >({
      appRouterFilename: "layout",
      params: [],
      inInAppRouterFolder: true,
      isAppRouterFile: true,
      asyncRequestAPI: null,
      allowedPropsForFileNameType: [...ALLOWED_PROPS_FOR_LAYOUT],
      routePath: "/",
      parentRoutePath: "/",
    });
  });
  it("should return an empty array if the file is an app router file but the app folder is not found", () => {
    expect(getFileInfo("/index.ts")).toEqual<ReturnType<typeof getFileInfo>>({
      appRouterFilename: null,
      allowedPropsForFileNameType: null,
      params: [],
      inInAppRouterFolder: false,
      isAppRouterFile: false,
      asyncRequestAPI: null,
      routePath: null,
      parentRoutePath: null,
    });
  });
  it("should return an empty array if the file is an app router file but the app folder is not found", () => {
    expect(getFileInfo("app/index.ts")).toEqual<ReturnType<typeof getFileInfo>>(
      {
        appRouterFilename: null,
        params: [],
        allowedPropsForFileNameType: null,
        inInAppRouterFolder: true,
        isAppRouterFile: false,
        asyncRequestAPI: null,
        routePath: "/",
        parentRoutePath: "/",
      },
    );
  });

  it("should read the parameters from the file name", () => {
    expect(getFileInfo("app/[id]/page.tsx")).toEqual<
      ReturnType<typeof getFileInfo>
    >({
      params: [{ catchAll: false, name: "id", current: true }],
      appRouterFilename: "page",
      allowedPropsForFileNameType: [...ALLOWED_PROPS_FOR_PAGE],
      inInAppRouterFolder: true,
      isAppRouterFile: true,
      asyncRequestAPI: null,
      routePath: "/[id]",
      parentRoutePath: "/",
    });
    expect(getFileInfo("app/[id]/[slug]/page.tsx")).toEqual<
      ReturnType<typeof getFileInfo>
    >({
      params: [
        { catchAll: false, name: "id", current: false },
        { catchAll: false, name: "slug", current: true },
      ],
      appRouterFilename: "page",
      allowedPropsForFileNameType: [...ALLOWED_PROPS_FOR_PAGE],
      inInAppRouterFolder: true,
      isAppRouterFile: true,
      asyncRequestAPI: null,
      routePath: "/[id]/[slug]",
      parentRoutePath: "/[id]",
    });
  });
  expect(getFileInfo("app/[id]/[...catchAll]/page.tsx")).toEqual<
    ReturnType<typeof getFileInfo>
  >({
    params: [
      { catchAll: false, name: "id", current: false },
      { catchAll: true, name: "catchAll", current: true },
    ],
    appRouterFilename: "page",
    inInAppRouterFolder: true,
    isAppRouterFile: true,
    asyncRequestAPI: null,
    allowedPropsForFileNameType: [...ALLOWED_PROPS_FOR_PAGE],
    routePath: "/[id]/[...catchAll]",
    parentRoutePath: "/[id]",
  });

  expect(getFileInfo("app/[id]/[...catchAll]/notCurrent/default.tsx")).toEqual<
    ReturnType<typeof getFileInfo>
  >({
    params: [
      { catchAll: false, name: "id", current: false },
      { catchAll: true, name: "catchAll", current: false },
    ],
    appRouterFilename: "default",
    inInAppRouterFolder: true,
    isAppRouterFile: true,
    asyncRequestAPI: null,
    allowedPropsForFileNameType: [PARAMS_PROP_NAME],
    routePath: "/[id]/[...catchAll]/notCurrent",
    parentRoutePath: "/[id]/[...catchAll]",
  });

  expect(getFileInfo("app/blog/[[...slug]]/page.tsx")).toEqual<
    ReturnType<typeof getFileInfo>
  >({
    params: [{ catchAll: true, name: "slug", current: true }],
    appRouterFilename: "page",
    inInAppRouterFolder: true,
    isAppRouterFile: true,
    asyncRequestAPI: null,
    allowedPropsForFileNameType: [...ALLOWED_PROPS_FOR_PAGE],
    routePath: "/blog/[[...slug]]",
    parentRoutePath: "/blog",
  });
});

describe("getRoutePath", () => {
  it("should return null when there is no app folder", () => {
    expect(getRoutePath("/some/path/page.tsx")).toBeNull();
  });

  it("should return / for root app files", () => {
    expect(getRoutePath("app/page.tsx")).toBe("/");
    expect(getRoutePath("src/app/layout.tsx")).toBe("/");
  });

  it("should derive route path from file path", () => {
    expect(getRoutePath("app/blog/[slug]/page.tsx")).toBe("/blog/[slug]");
    expect(getRoutePath("src/app/shop/[id]/[item]/page.tsx")).toBe(
      "/shop/[id]/[item]",
    );
  });

  it("should strip route groups from the path", () => {
    expect(getRoutePath("app/(marketing)/page.tsx")).toBe("/");
    expect(getRoutePath("app/(shop)/[id]/page.tsx")).toBe("/[id]");
  });

  it("should strip parallel routes from the path", () => {
    expect(getRoutePath("app/dashboard/@analytics/page.tsx")).toBe(
      "/dashboard",
    );
    expect(getRoutePath("app/@slot/page.tsx")).toBe("/");
  });

  it("should handle catch-all segments", () => {
    expect(getRoutePath("app/blog/[...slug]/page.tsx")).toBe("/blog/[...slug]");
  });

  it("should handle optional catch-all segments", () => {
    expect(getRoutePath("app/blog/[[...slug]]/page.tsx")).toBe(
      "/blog/[[...slug]]",
    );
  });
});

describe("getParentRoutePath", () => {
  it("should return null when there is no app folder", () => {
    expect(getParentRoutePath("/some/path/page.tsx")).toBeNull();
  });

  it("should return / for root app files", () => {
    expect(getParentRoutePath("app/page.tsx")).toBe("/");
    expect(getParentRoutePath("src/app/layout.tsx")).toBe("/");
  });

  it("should derive parent route path from file path", () => {
    expect(getParentRoutePath("app/blog/[slug]/page.tsx")).toBe("/blog");
    expect(getParentRoutePath("src/app/shop/[id]/[item]/page.tsx")).toBe(
      "/shop/[id]",
    );
  });

  it("should strip route groups from the parent path", () => {
    expect(getParentRoutePath("app/(marketing)/page.tsx")).toBe("/");
    expect(getParentRoutePath("app/(shop)/[id]/page.tsx")).toBe("/");
  });

  it("should handle optional catch-all segments", () => {
    expect(getParentRoutePath("app/blog/[[...slug]]/page.tsx")).toBe("/blog");
  });
});
