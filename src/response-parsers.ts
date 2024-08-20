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
    webId: location.webId,
    pod: location.pod,
    name: location.name,
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
  };
}

function parseDatedObjectString(s: string):
  | {
      error: true;
      message: string;
    }
  | {
      error: false;
      value: any;
    } {
  // Filter out bad values
  let parsed: any;
  try {
    parsed = JSON.parse(s);
  } catch (e) {
    return {
      error: true,
      message: "Cannot parse JSON from pod",
    };
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      error: true,
      message: "Expected an object from pod",
    };
  }

  const value = {
    ...parsed,
    lastModified: new Date(parsed.lastModified ?? NaN),
  };

  return {
    error: false,
    value,
  };
}

const decoder = new TextDecoder();
// See JSON lines: https://jsonlines.org
export async function* parseJSONLinesResponse(
  response: Response,
): AsyncGenerator<
  | {
      error: true;
      message: string;
    }
  | {
      error: false;
      value: any;
    },
  void,
  void
> {
  if (!response.ok) {
    yield {
      error: true,
      message: (await parseErrorResponse(response)).message,
    };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield {
      error: true,
      message: "Failed to get a reader from the response body",
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
        yield parseDatedObjectString(part);
      }
    }

    if (done) break;
  }

  // Clear the buffer
  if (buffer) {
    yield parseDatedObjectString(buffer);
  }
}

export async function* fetchJSONLines(
  fetch_: typeof fetch,
  ...args: Parameters<typeof fetch>
): AsyncGenerator<
  | {
      error: true;
      message: string;
    }
  | {
      error: false;
      value: any;
    },
  void,
  void
> {
  let response: Response;
  try {
    response = await fetch_(...args);
  } catch (e) {
    if (e instanceof Error) {
      yield {
        error: true,
        message: e.toString(),
      };
      return;
    } else {
      throw e;
    }
  }

  for await (const parsed of parseJSONLinesResponse(response)) {
    yield parsed;
  }
}
