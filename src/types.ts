import { type JTDDataType } from "ajv/dist/core";
import type { Operation as JSONPatchOperation } from "fast-json-patch";

export type GraffitiObject = {
  value?: {};
  channels: string[];
  acl?: string[];
  webId: string;
  name: string;
  pod: string;
  lastModified: Date;
  tombstone: boolean;
};

export type GraffitiLocalObject = Pick<
  GraffitiObject,
  "value" | "channels" | "acl"
>;

export type GraffitiLocation = Pick<GraffitiObject, "webId" | "name" | "pod">;

export type GraffitiObjectTyped<Schema> = GraffitiObject & JTDDataType<Schema>;

export interface GraffitiPatch {
  value?: JSONPatchOperation[];
  channels?: JSONPatchOperation[];
  acl?: JSONPatchOperation[];
}

export type GraffitiSession = {
  pods: string[];
} & (
  | {
      pod: string;
      fetch: typeof fetch;
      webId: string;
    }
  | {
      pod?: undefined;
      fetch?: undefined;
      webId?: undefined;
    }
);

export function locationToUrl(object: GraffitiObject): string;
export function locationToUrl(location: GraffitiLocation): string;
export function locationToUrl(location: GraffitiLocation) {
  const base = new URL(location.pod).origin;
  return `${base}/${encodeURIComponent(location.webId)}/${encodeURIComponent(location.name)}`;
}

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
