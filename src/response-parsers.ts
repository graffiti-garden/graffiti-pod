import type { GraffitiLocation, GraffitiObject } from "./types";

export async function parseErrorResponse(response: Response): Promise<Error> {
  const text = await response.text();
  if (text && text.length) {
    try {
      const error = JSON.parse(text);
      return new Error(error.message);
    } catch {
      return new Error(text);
    }
  } else {
    return new Error(`HTTP error ${response.status}`);
  }
}

export function parseEncodedStringArrayHeader<T>(
  header: string | null | undefined,
  nullValue: T,
): string[] | T {
  if (typeof header !== "string") return nullValue;
  return header
    .split(",")
    .filter((s) => s)
    .map(decodeURIComponent);
}

export async function parseGraffitiObjectResponse(
  response: Response,
  location: GraffitiLocation,
  isGet: boolean,
): Promise<GraffitiObject> {
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  let value: any;
  try {
    value = await response.json();
  } catch (e) {
    value = null;
  }
  return {
    tombstone: !isGet,
    value,
    channels: parseEncodedStringArrayHeader(
      response.headers.get("channels"),
      [],
    ),
    acl: parseEncodedStringArrayHeader(
      response.headers.get("access-control-list"),
      undefined,
    ),
    lastModified: new Date(response.headers.get("last-modified") ?? NaN),
    ...location,
  };
}

function parseGraffitiObjectString(s: string): any {
  // Filter out bad values
  let parsed: any;
  try {
    parsed = JSON.parse(s);
  } catch (e) {
    return;
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) return;

  return {
    ...parsed,
    lastModified: new Date(parsed.lastModified ?? NaN),
  };
}

const decoder = new TextDecoder();
export async function* parseJSONListResponse(response: Response) {
  if (!response.ok) {
    yield {
      error: (await parseErrorResponse(response)).message,
    };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield {
      error: "Failed to get a reader from the response body",
    };
    return;
  }
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();

    if (value) {
      buffer += decoder.decode(value);
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const parsed = parseGraffitiObjectString(part);
        if (parsed) yield parsed;
      }
    }

    if (done) break;
  }

  // Clear the buffer
  if (buffer) {
    const parsed = parseGraffitiObjectString(buffer);
    if (parsed) yield parsed;
  }
}

export async function* parseJSONListFetch(
  fetch_: typeof fetch | undefined,
  ...args: Parameters<typeof fetch>
) {
  let response: Response;
  try {
    response = await (fetch_ ?? fetch)(...args);
  } catch (e) {
    yield {
      error: e.toString(),
    };
    return;
  }

  for await (const parsed of parseJSONListResponse(response)) {
    yield parsed;
  }
}
