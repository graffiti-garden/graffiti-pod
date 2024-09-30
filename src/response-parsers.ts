import type { GraffitiLocation, GraffitiObjectBase } from "./types";

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
): Promise<GraffitiObjectBase> {
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  let value: {} | undefined;
  try {
    value = await response.json();
  } catch (e) {
    value = undefined;
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
