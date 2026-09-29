const trimTrailingSlashes = (value: string): string => (value || "").replace(/\/+$/, "");

/** Escape a value embedded inside an OData single-quoted string literal. */
export const escapeODataString = (value: string): string => (value || "").replace(/'/g, "''");

/** Escape an OData string value before placing it inside a query parameter. */
export const encodeODataLiteral = (value: string): string =>
  encodeURIComponent(escapeODataString(value));

/**
 * Build a SharePoint REST URL for a list or library. The title is treated as
 * an OData string literal first, then encoded as a URL path segment.
 */
export const listApiUrl = (
  siteUrl: string,
  listTitle: string,
  resource: string = "items",
  query: string = "",
): string => {
  const site = trimTrailingSlashes(siteUrl);
  const title = encodeURIComponent(escapeODataString(listTitle));
  const suffix = resource.replace(/^\/+/, "");
  const params = query ? (query.charAt(0) === "?" ? query : `?${query}`) : "";
  return `${site}/_api/web/lists/getbytitle('${title}')/${suffix}${params}`;
};
