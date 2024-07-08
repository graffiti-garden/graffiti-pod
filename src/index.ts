import { JSONSchema4 } from "json-schema";
import WebIdManager from "./webid-manager";
import type { Operation as JSONPatchOperation } from "fast-json-patch";
import { obscureChannel } from "./info-hash";

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

const decoder = new TextDecoder();

export default class GraffitiClient {
  private webIdManager = new WebIdManager();

  static toUrl(object: GraffitiObject): string;
  static toUrl(location: GraffitiLocation): string;
  static toUrl(location: GraffitiLocation) {
    return `${location.graffitiPod}/${encodeURIComponent(location.webId)}/${encodeURIComponent(location.name)}`;
  }

  static fromUrl(url: string): GraffitiLocation {
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

  private static parseLocationOrUrl(locationOrUrl: GraffitiLocation | string): {
    url: string;
    location: GraffitiLocation;
  } {
    if (typeof locationOrUrl === "string") {
      return {
        url: locationOrUrl,
        location: GraffitiClient.fromUrl(locationOrUrl),
      };
    } else {
      return {
        url: GraffitiClient.toUrl(locationOrUrl),
        location: locationOrUrl,
      };
    }
  }

  private static async parseReponseError(response: Response): Promise<string> {
    try {
      const error = await response.json();
      return error.message;
    } catch {
      return response.statusText;
    }
  }

  private static async parseGraffitiObjectResponse(
    response: Response,
    location: GraffitiLocation,
  ): Promise<GraffitiObject> {
    if (!response.ok) {
      throw new Error(await GraffitiClient.parseReponseError(response));
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

  async put(
    object: GraffitiLocalObject,
    location: GraffitiLocation,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async put(
    object: GraffitiLocalObject,
    url: string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async put(
    object: GraffitiLocalObject,
    locationOrUrl: GraffitiLocation | string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject> {
    const { location, url } = GraffitiClient.parseLocationOrUrl(locationOrUrl);
    await this.webIdManager.addGraffitiPod(
      location.webId,
      location.graffitiPod,
      options,
    );
    const headers = {
      "Content-Type": "application/json",
    };
    for (const [prop, key] of [
      ["acl", "Access-Control-List"],
      ["channels", "Channels"],
    ] as const) {
      if (object[prop]) {
        headers[key] = object[prop].map(encodeURIComponent).join(",");
      }
    }
    const response = await (options?.fetch ?? fetch)(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(object.value),
    });
    return GraffitiClient.parseGraffitiObjectResponse(response, location);
  }

  async get(
    location: GraffitiLocation,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async get(
    url: string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async get(
    locationOrUrl: GraffitiLocation | string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject> {
    const { location, url } = GraffitiClient.parseLocationOrUrl(locationOrUrl);
    if (
      !(await this.webIdManager.hasGraffitiPod(
        location.webId,
        location.graffitiPod,
        options,
      ))
    ) {
      throw new Error(
        `The Graffiti pod ${location.graffitiPod} is not registered with the WebID ${location.webId}`,
      );
    }
    const response = await (options?.fetch ?? fetch)(url);
    return GraffitiClient.parseGraffitiObjectResponse(response, location);
  }

  async delete(
    location: GraffitiLocation,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async delete(
    url: string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async delete(
    locationOrUrl: GraffitiLocation | string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject> {
    const { location, url } = GraffitiClient.parseLocationOrUrl(locationOrUrl);
    const response = await (options?.fetch ?? fetch)(url, {
      method: "DELETE",
    });
    return GraffitiClient.parseGraffitiObjectResponse(response, location);
  }

  async patch(
    patch: GraffitiPatch,
    location: GraffitiLocation,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async patch(
    patch: GraffitiPatch,
    url: string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async patch(
    patch: GraffitiPatch,
    locationOrUrl: GraffitiLocation | string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject> {
    const { location, url } = GraffitiClient.parseLocationOrUrl(locationOrUrl);

    const requestInit: RequestInit = { method: "PATCH", headers: {} };
    if (patch.value) {
      requestInit.headers!["Content-Type"] = "application/json-patch+json";
      requestInit.body = JSON.stringify(patch.value);
    }
    for (const [prop, key] of [
      ["acl", "Access-Control-List"],
      ["channels", "Channels"],
    ] as const) {
      if (patch[prop]) {
        requestInit.headers![key] = patch[prop]
          .map((p) => JSON.stringify(p))
          .map(encodeURIComponent)
          .join(",");
      }
    }
    const response = await (options?.fetch ?? fetch)(url, requestInit);
    return GraffitiClient.parseGraffitiObjectResponse(response, location);
  }

  private static parseGraffitiObjectString(
    s: string,
    graffitiPod: string,
  ): GraffitiObject {
    const parsed = JSON.parse(s);
    return {
      ...parsed,
      lastModified: new Date(parsed.lastModified),
      channels: parsed.channels.map(
        (c: { value: string; infoHash: string }) => c.value,
      ),
      graffitiPod,
    };
  }

  async *query(
    channels: string[],
    graffitiPod: string,
    options?: {
      query?: JSONSchema4;
      ifModifiedSince?: Date;
      limit?: number;
      skip?: number;
      fetch?: typeof fetch;
    },
  ): AsyncGenerator<GraffitiObject, void, void> {
    const requestInit: RequestInit = { method: "POST", headers: {} };

    requestInit.headers!["Channels"] = channels
      .map((c) => obscureChannel(c, graffitiPod))
      .join(",");

    if (options) {
      if (options.query) {
        requestInit.headers!["Content-Type"] = "application/json";
        requestInit.body = JSON.stringify(options.query);
      }
      if (options.ifModifiedSince) {
        requestInit.headers!["If-Modified-Since"] =
          options.ifModifiedSince.toISOString();
      }
      if (options.limit || options?.skip) {
        requestInit.headers!["Range"] =
          `=${options.skip ?? ""}-${options.limit ?? ""}`;
      }
    }

    const response = await (options?.fetch ?? fetch)(graffitiPod, requestInit);
    if (!response.ok) {
      const errorMessage = await GraffitiClient.parseReponseError(response);
      throw new Error(errorMessage);
    }

    // Parse the body as a readable stream
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
          yield GraffitiClient.parseGraffitiObjectString(part, graffitiPod);
        }
      }

      if (done) break;
    }
    // Clear the buffer
    if (buffer) {
      yield GraffitiClient.parseGraffitiObjectString(buffer, graffitiPod);
    }
  }
}
