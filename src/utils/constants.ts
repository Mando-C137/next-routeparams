export const PARAMS_PROP_NAME = "params";
export const SEARCHPARAMS_PROP_NAME = "searchParams";
export const CHILDREN_PROP_NAME = "children";

export const ALLOWED_PROPS_FOR_PAGE = [
  PARAMS_PROP_NAME,
  SEARCHPARAMS_PROP_NAME,
] as const;

export const ALLOWED_PROPS_FOR_LAYOUT = [
  PARAMS_PROP_NAME,
  CHILDREN_PROP_NAME,
] as const;

export const METADATA_FUNCTION_NAMES = [
  "generateMetadata",
  "generateMetadataFile",
] as const;
export type MetadataFunction = (typeof METADATA_FUNCTION_NAMES)[number];

export const ROUTE_HANDLERS_FUNCTION_NAMES = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
export type RouteHandlerFunction =
  (typeof ROUTE_HANDLERS_FUNCTION_NAMES)[number];
