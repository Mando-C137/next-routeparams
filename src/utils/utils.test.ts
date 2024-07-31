import { readFileBasedParameters } from "./utils";

describe("readFileBasedParameters", () => {
  it("should return an empty array if the file is not an app router file", () => {
    expect(readFileBasedParameters("app/page.tsx")).toEqual([]);
  });
  it("should return an empty array if the file is an app router file but the app folder is not found", () => {
    expect(readFileBasedParameters("page.tsx")).toEqual([]);
  });
  it("should return an empty array if the file is an app router file but the app folder is not found", () => {
    expect(readFileBasedParameters("app/page.tsx")).toEqual([]);
  });

  it("should read the parameters from the file name", () => {
    expect(readFileBasedParameters("app/[id]/page.tsx")).toEqual([
      { catchAll: false, name: "id", current: true },
    ]);
    expect(readFileBasedParameters("app/[id]/[slug]/page.tsx")).toEqual([
      { catchAll: false, name: "id", current: false },
      { catchAll: false, name: "slug", current: true },
    ]);
    expect(readFileBasedParameters("app/[id]/[...catchAll]/page.tsx")).toEqual([
      { catchAll: false, name: "id", current: false },
      { catchAll: true, name: "catchAll", current: true },
    ]);

    expect(
      readFileBasedParameters("app/[id]/[...catchAll]/notCurrent/page.tsx"),
    ).toEqual([
      { catchAll: false, name: "id", current: false },
      { catchAll: true, name: "catchAll", current: false },
    ]);
  });
});
