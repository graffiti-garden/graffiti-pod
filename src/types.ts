import type { Operation as JSONPatchOperation } from "fast-json-patch";

export interface GraffitiLocation {
  name: string;
  webId: string;
  graffitiPod: string;
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

export type GraffitiObject = GraffitiLocation & { lastModified: Date } & (
    | ({ tombstone: false } & GraffitiLocalObject)
    | {
        tombstone: true;
        value: null;
        channels: string[];
        acl?: string[];
      }
  );

export function toUrl(object: GraffitiObject): string;
export function toUrl(location: GraffitiLocation): string;
export function toUrl(location: GraffitiLocation) {
  return `${location.graffitiPod}/${encodeURIComponent(location.webId)}/${encodeURIComponent(location.name)}`;
}

export function fromUrl(url: string): GraffitiLocation {
  const parts = url.split("/");
  const nameEncoded = parts.pop();
  const webIdEncoded = parts.pop();
  if (!nameEncoded || !webIdEncoded || !parts.length) {
    throw new Error("Invalid Graffiti URL");
  }
  return {
    name: decodeURIComponent(nameEncoded),
    webId: decodeURIComponent(webIdEncoded),
    graffitiPod: parts.join("/"),
  };
}

export function parseLocationOrUrl(locationOrUrl: GraffitiLocation | string): {
  url: string;
  location: GraffitiLocation;
} {
  if (typeof locationOrUrl === "string") {
    return {
      url: locationOrUrl,
      location: fromUrl(locationOrUrl),
    };
  } else {
    return {
      url: toUrl(locationOrUrl),
      location: locationOrUrl,
    };
  }
}
