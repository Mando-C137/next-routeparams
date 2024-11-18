import { getFileInfo } from "./fs";
import {
  ALLOWED_PROPS_FOR_LAYOUT,
  ALLOWED_PROPS_FOR_PAGE,
  PARAMS_PROP_NAME,
} from "./constants";

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
  });
});
