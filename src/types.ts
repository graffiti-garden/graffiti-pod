import { type JTDDataType } from "ajv/dist/core";
import type { Operation as JSONPatchOperation } from "fast-json-patch";

export interface GraffitiObjectBase {
  value: {};
  channels: string[];
  acl?: string[];
  webId: string;
  name: string;
  pod: string;
  lastModified: Date;
  tombstone: boolean;
}

export type GraffitiLocalObjectBase = Pick<
  GraffitiObjectBase,
  "value" | "channels" | "acl"
>;

export type GraffitiLocation = Pick<
  GraffitiObjectBase,
  "webId" | "name" | "pod"
>;

export type GraffitiObject<Schema> = GraffitiObjectBase & JTDDataType<Schema>;
export type GraffitiLocalObject<Schema> = GraffitiLocalObjectBase &
  JTDDataType<Schema>;

export interface GraffitiPatch {
  value?: JSONPatchOperation[];
  channels?: JSONPatchOperation[];
  acl?: JSONPatchOperation[];
}

export type GraffitiSession =
  | {
      fetch: typeof fetch;
      webId: string;
    }
  | {
      fetch?: undefined;
      webId?: undefined;
    }
  | undefined;

/**
 * Convert a {@link GraffitiLocation} object containing a
 * `webId`, `name`, and `pod` into a graffiti URL
 * of the form `https://pod.example.com/webId/name`.
 */
export function locationToUrl(location: GraffitiLocation) {
  const base = new URL(location.pod).origin;
  return `${base}/${encodeURIComponent(location.webId)}/${encodeURIComponent(location.name)}`;
}
/**
 * An alias of {@link locationToUrl}
 */
export function objectToUrl(object: GraffitiObjectBase) {
  return locationToUrl(object);
}

/**
 * Parse a graffiti URL of the form `https://pod.example.com/webId/name`
 * into a {@link GraffitiLocation} object containing a `webId`, `name`, and `pod`.
 */
export function urlToLocation(url: string): GraffitiLocation {
  const parts = url.split("/");
  const nameEncoded = parts.pop();
  const webIdEncoded = parts.pop();
  if (!nameEncoded || !webIdEncoded || !parts.length) {
    throw new Error("Invalid Graffiti URL");
  }
  return {
    name: decodeURIComponent(nameEncoded),
    webId: decodeURIComponent(webIdEncoded),
    pod: parts.join("/"),
  };
}

export function parseLocationOrUrl(locationOrUrl: GraffitiLocation | string): {
  url: string;
  location: GraffitiLocation;
} {
  if (typeof locationOrUrl === "string") {
    return {
      url: locationOrUrl,
      location: urlToLocation(locationOrUrl),
    };
  } else {
    return {
      url: locationToUrl(locationOrUrl),
      location: locationOrUrl,
    };
  }
}
