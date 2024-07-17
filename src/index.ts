import WebIdManager from "./webid-manager";
import type {
  GraffitiLocalObject,
  GraffitiLocation,
  GraffitiObject,
  GraffitiPatch,
} from "./types";
import type { JSONSchema4 } from "json-schema";
import {
  parseGraffitiObjectResponse,
  parseJSONListResponse,
} from "./response-parsers";
import { toUrl, fromUrl, parseLocationOrUrl } from "./types";
import {
  encodeACL,
  encodeChannels,
  encodeIfModifiedSince,
  encodeJSONBody,
  encodeSkipLimit,
} from "./header-encoders";

export { GraffitiLocalObject, GraffitiLocation, GraffitiObject, GraffitiPatch };

export default class GraffitiClient {
  private webIdManager = new WebIdManager();
  static toUrl = toUrl;
  static fromUrl = fromUrl;

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
    const { location, url } = parseLocationOrUrl(locationOrUrl);
    await this.webIdManager.addGraffitiPod(
      location.webId,
      location.graffitiPod,
      options,
    );
    const requestInit: RequestInit = { method: "PUT" };
    encodeJSONBody(requestInit, object.value);
    if (object["channels"]) {
      encodeChannels(requestInit, object["channels"]);
    }
    if (object["acl"]) {
      encodeACL(requestInit, object["acl"]);
    }
    const response = await (options?.fetch ?? fetch)(url, requestInit);
    return parseGraffitiObjectResponse(response, location);
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
    const { location, url } = parseLocationOrUrl(locationOrUrl);
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
    return parseGraffitiObjectResponse(response, location);
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
    const { location, url } = parseLocationOrUrl(locationOrUrl);
    const response = await (options?.fetch ?? fetch)(url, {
      method: "DELETE",
    });
    return parseGraffitiObjectResponse(response, location);
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
    const { location, url } = parseLocationOrUrl(locationOrUrl);

    const requestInit: RequestInit = { method: "PATCH" };
    if (patch.value) {
      encodeJSONBody(requestInit, patch.value);
    }
    if (patch.channels) {
      encodeChannels(
        requestInit,
        patch.channels.map((p) => JSON.stringify(p)),
      );
    }
    if (patch.acl) {
      encodeACL(
        requestInit,
        patch.acl.map((p) => JSON.stringify(p)),
      );
    }
    const response = await (options?.fetch ?? fetch)(url, requestInit);
    return parseGraffitiObjectResponse(response, location);
  }

  private list(listType: string) {
    return async function* (
      graffitiPod: string,
      options?: {
        fetch?: typeof fetch;
        ifModifiedSince?: Date;
      },
    ): AsyncGenerator<any, void, void> {
      const requestInit: RequestInit = { method: "POST" };
      if (options?.ifModifiedSince) {
        encodeIfModifiedSince(requestInit, options.ifModifiedSince);
      }
      const response = await (options?.fetch ?? fetch)(
        graffitiPod + "/list-" + listType,
        requestInit,
      );
      for await (const json of parseJSONListResponse(response)) {
        yield json;
      }
    };
  }

  listChannels(
    ...args: Parameters<ReturnType<GraffitiClient["list"]>>
  ): AsyncGenerator<
    {
      channel: string;
      count: number;
      lastModified: Date;
    },
    void,
    void
  > {
    return this.list("channels")(...args);
  }

  listOrphans(
    ...args: Parameters<ReturnType<GraffitiClient["list"]>>
  ): AsyncGenerator<
    {
      name: string;
      tombstone: boolean;
      lastModified: Date;
    },
    void,
    void
  > {
    return this.list("orphans")(...args);
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
    const requestInit: RequestInit = { method: "POST" };
    encodeChannels(requestInit, channels);

    if (options) {
      if (options.query) {
        encodeJSONBody(requestInit, options.query);
      }
      if (options.ifModifiedSince) {
        encodeIfModifiedSince(requestInit, options.ifModifiedSince);
      }
      encodeSkipLimit(requestInit, options.skip, options.limit);
    }

    const response = await (options?.fetch ?? fetch)(graffitiPod, requestInit);

    for await (const json of parseJSONListResponse(response)) {
      const object: GraffitiObject = {
        ...json,
        graffitiPod,
      };

      // Only yield the object if the owner has
      // authorized the graffiti pod to host for them.
      if (
        await this.webIdManager.hasGraffitiPod(
          object.webId,
          object.graffitiPod,
          options,
        )
      ) {
        yield object;
      }
    }
  }
}
