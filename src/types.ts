import type { Operation as JSONPatchOperation } from "fast-json-patch";

export interface GraffitiLocation {
  name: string;
  webId: string;
  pod: string;
}

export interface GraffitiLocalObject {
  value: any;
  channels: string[];
  acl?: string[];
}

export interface GraffitiPatch {
  value?: JSONPatchOperation[];
  channels?: JSONPatchOperation[];
  acl?: JSONPatchOperation[];
}

export type GraffitiObject = GraffitiLocalObject &
  GraffitiLocation & { lastModified: Date; tombstone: boolean };

export function locationToUrl(object: GraffitiObject): string;
export function locationToUrl(location: GraffitiLocation): string;
export function locationToUrl(location: GraffitiLocation) {
  return `${location.pod}/${encodeURIComponent(location.webId)}/${encodeURIComponent(location.name)}`;
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
