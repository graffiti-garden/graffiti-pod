import type { JSONSchema4 } from "json-schema";

function addHeader(requestInit: RequestInit, key: string, value: string): void {
  if (!requestInit.headers || !(requestInit.headers instanceof Headers)) {
    requestInit.headers = new Headers();
  }
  requestInit.headers.set(key, value);
}

function encodeStringArray(stringArray: string[]): string {
  return stringArray.map(encodeURIComponent).join(",");
}

export function encodeQueryParams(
  url: string,
  params: {
    channels?: string[];
    acl?: string[];
    schema?: JSONSchema4;
  },
) {
  url += "?";
  if (params.channels) {
    url += "channels=" + encodeStringArray(params.channels) + "&";
  }
  if (params.acl) {
    url += "access-control-list=" + encodeStringArray(params.acl) + "&";
  }
  if (params.schema) {
    url += "schema=" + encodeURIComponent(JSON.stringify(params.schema)) + "&";
  }
  return url;
}

export function encodeJSONBody(requestInit: RequestInit, body: any): void {
  addHeader(requestInit, "Content-Type", "application/json; charset=utf-8");
  requestInit.body = JSON.stringify(body);
}

export function encodeIfModifiedSince(
  requestInit: RequestInit,
  ifModifiedSince: Date,
): void {
  addHeader(requestInit, "If-Modified-Since", ifModifiedSince.toISOString());
}

export function encodeSkipLimit(
  requestInit: RequestInit,
  skip?: number,
  limit?: number,
): void {
  if (typeof skip !== "number" && typeof limit !== "number") return;
  if (typeof skip === "number" && skip < 0) {
    throw new Error("The skip must be non-negative.");
  }
  if (typeof limit === "number" && limit < 1) {
    throw new Error("The limit must be at least 1.");
  }
  addHeader(
    requestInit,
    "Range",
    `=${skip ?? ""}-${typeof limit === "number" ? limit - 1 + (skip ?? 0) : ""}`,
  );
}
