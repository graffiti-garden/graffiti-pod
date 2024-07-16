function addHeader(requestInit: RequestInit, key: string, value: string): void {
  if (!requestInit.headers) {
    requestInit.headers = {};
  }
  requestInit.headers[key] = value;
}

function encodeStringArray(
  requestInit: RequestInit,
  key: string,
  stringArray: string[],
): void {
  addHeader(requestInit, key, stringArray.map(encodeURIComponent).join(","));
}

export function encodeChannels(
  requestInit: RequestInit,
  channels: string[],
): void {
  encodeStringArray(requestInit, "Channels", channels);
}

export function encodeACL(requestInit: RequestInit, acl: string[]): void {
  encodeStringArray(requestInit, "Access-Control-List", acl);
}

export function encodeJSONBody(requestInit: RequestInit, body: any): void {
  addHeader(requestInit, "Content-Type", "application/json");
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
