import { GraffitiErrorOther } from "@graffiti-garden/api";
import {
  GraffitiErrorForbidden,
  GraffitiErrorInvalidSchema,
  GraffitiErrorNotFound,
  GraffitiErrorPatchError,
  GraffitiErrorPatchTestFailed,
  GraffitiErrorSchemaMismatch,
  GraffitiErrorUnauthorized,
} from "@graffiti-garden/api";
import type {
  GraffitiLocation,
  GraffitiObjectBase,
} from "@graffiti-garden/api";

export async function catchResponseErrors(response: Response) {
  if (response.ok) return;
  let text = await response.text();
  try {
    const error = JSON.parse(text);
    if ("message" in error) {
      text = error.message;
    }
  } catch {}
  const status = response.status;
  if (status === 404) {
    throw new GraffitiErrorNotFound(text);
  } else if (status === 403) {
    throw new GraffitiErrorForbidden(text);
  } else if (status === 401) {
    throw new GraffitiErrorUnauthorized(text);
  } else if (status === 422) {
    if (text.startsWith("PatchError")) {
      throw new GraffitiErrorPatchError(text);
    } else if (text.startsWith("InvalidSchema")) {
      throw new GraffitiErrorInvalidSchema(text);
    }
  } else if (status === 412) {
    if (text.startsWith("PatchTestFailed")) {
      throw new GraffitiErrorPatchTestFailed(text);
    } else if (text.startsWith("SchemaMismatch")) {
      throw new GraffitiErrorSchemaMismatch(text);
    }
  }

  throw new GraffitiErrorOther(text);
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
  isGet: boolean = false,
): Promise<GraffitiObjectBase> {
  await catchResponseErrors(response);

  let value: {};
  const text = await response.text();
  try {
    value = JSON.parse(text);
  } catch (e) {
    throw new GraffitiErrorOther("Received invalid JSON response from server");
  }
  const lastModifiedGMT = response.headers.get("last-modified");
  if (!lastModifiedGMT) {
    throw new GraffitiErrorOther(
      "Received response from server without Last-Modified header",
    );
  }

  return {
    actor: location.actor,
    source: location.source,
    name: location.name,
    tombstone: !isGet,
    value,
    channels: parseEncodedStringArrayHeader(
      response.headers.get("channels"),
      [],
    ),
    allowed: parseEncodedStringArrayHeader(
      response.headers.get("allowed"),
      undefined,
    ),
    lastModified: new Date(lastModifiedGMT).getTime(),
  };
}
