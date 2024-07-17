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

export async function parseGraffitiObjectResponse(
  response: Response,
  location: GraffitiLocation,
): Promise<GraffitiObject> {
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 201) {
    return {
      tombstone: true,
      value: null,
      channels: [],
      lastModified: new Date(0),
      ...location,
    };
  } else {
    return {
      tombstone: false,
      value: await response.json(),
      channels: response.headers.has("channels")
        ? response.headers
            .get("channels")!
            .split(",")
            .filter((s) => s)
            .map(decodeURIComponent)
        : [],
      acl: response.headers
        .get("access-control-list")
        ?.split(",")
        .filter((s) => s)
        .map(decodeURIComponent),
      lastModified: new Date(response.headers.get("last-modified") ?? 0),
      ...location,
    };
  }
}

function parseGraffitiObjectString(s: string): any {
  const parsed = JSON.parse(s);
  return {
    ...parsed,
    lastModified: new Date(parsed.lastModified),
  };
}

const decoder = new TextDecoder();
export async function* parseJSONListResponse(response: Response) {
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get a reader from the response body");
  }
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();

    if (value) {
      buffer += decoder.decode(value);
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        yield parseGraffitiObjectString(part);
      }
    }

    if (done) break;
  }

  // Clear the buffer
  if (buffer) {
    yield parseGraffitiObjectString(buffer);
  }
}
