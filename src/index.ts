import Delegation from "./delegation";
import type {
  GraffitiLocalObject,
  GraffitiLocation,
  GraffitiObject,
  GraffitiPatch,
} from "./types";
import type { JSONSchema4 } from "json-schema";
import { parseGraffitiObjectResponse } from "./response-parsers";
import { locationToUrl, urlToLocation, parseLocationOrUrl } from "./types";
import { encodeJSONBody, encodeQueryParams } from "./header-encoders";
import LocalChanges from "./local-changes";
import LinesFeed from "./lines-feed";
import Ajv from "ajv";
import {
  GRAFFITI_OBJECT_SCHEMA,
  ORPHAN_RESULT_SCHEMA,
  CHANNEL_RESULT_SCHEMA,
} from "./schemas";

export { GraffitiLocalObject, GraffitiLocation, GraffitiObject, GraffitiPatch };

export default class GraffitiClient {
  readonly delegation = new Delegation();
  private readonly linesFeed = new LinesFeed();
  private readonly localChanges = new LocalChanges();
  private readonly validateGraffitiObject = new Ajv().compile(
    GRAFFITI_OBJECT_SCHEMA,
  );
  private readonly validateOrphanResult = new Ajv().compile(
    ORPHAN_RESULT_SCHEMA,
  );
  private readonly validateChannelResult = new Ajv().compile(
    CHANNEL_RESULT_SCHEMA,
  );

  locationToUrl(location: GraffitiLocation): string {
    return locationToUrl(location);
  }
  objectToUrl(object: GraffitiObject): string {
    return this.locationToUrl(object);
  }
  urlToLocation(url: string): GraffitiLocation {
    return urlToLocation(url);
  }

  private whichFetch(options?: { fetch?: typeof fetch }) {
    return options?.fetch ?? fetch;
  }

  async put(
    object: GraffitiLocalObject,
    location?: GraffitiLocation,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async put(
    object: GraffitiLocalObject,
    partialLocation: {
      name?: string;
      pod?: string;
      webId?: string;
    },
    options?: { fetch?: typeof fetch; pod?: string; webId?: string },
  ): Promise<GraffitiObject>;
  async put(
    object: GraffitiLocalObject,
    url?: string,
    options?: { fetch?: typeof fetch; pod?: string; webId?: string },
  ): Promise<GraffitiObject>;
  async put(
    object: GraffitiLocalObject,
    locationOrUrl?: string | { name?: string; pod?: string; webId?: string },
    options?: { fetch?: typeof fetch; pod?: string; webId?: string },
  ): Promise<GraffitiObject> {
    let location: GraffitiLocation;
    let url: string;

    if (typeof locationOrUrl === "string") {
      const parsed = parseLocationOrUrl(locationOrUrl);
      location = parsed.location;
      url = parsed.url;
    } else {
      let { webId, name, pod } = locationOrUrl ?? {};
      webId = webId ?? options?.webId;
      if (!webId) {
        throw new Error(
          "no webId provided to PUT either via the location or options.",
        );
      }
      pod = pod ?? options?.pod;
      if (!pod) {
        throw new Error(
          "no pod provided to PUT either via the location or options.",
        );
      }

      if (!name) {
        // Generate a random name if none is provided
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        name = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }

      location = { webId, pod, name };
      url = this.locationToUrl(location);
    }

    await this.delegation.addPod(location.webId, location.pod, options);
    const requestInit: RequestInit = { method: "PUT" };
    encodeJSONBody(requestInit, object.value);

    url = encodeQueryParams(url, object);
    const response = await this.whichFetch(options)(url, requestInit);
    const oldObject = await parseGraffitiObjectResponse(
      response,
      location,
      false,
    );
    this.localChanges.put(object, oldObject);
    return oldObject;
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
      !(await this.delegation.hasPod(location.webId, location.pod, options))
    ) {
      throw new Error(
        `The Graffiti pod ${location.pod} is not registered with the WebID ${location.webId}`,
      );
    }
    const response = await this.whichFetch(options)(url);
    return parseGraffitiObjectResponse(response, location, true);
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
    const response = await this.whichFetch(options)(url, {
      method: "DELETE",
    });
    const oldObject = await parseGraffitiObjectResponse(
      response,
      location,
      false,
    );
    this.localChanges.delete(oldObject);
    return oldObject;
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
    const urlWithQuery = encodeQueryParams(url, {
      channels: patch.channels?.map((p) => JSON.stringify(p)),
      acl: patch.acl?.map((p) => JSON.stringify(p)),
    });
    const response = await this.whichFetch(options)(urlWithQuery, requestInit);
    const oldObject = await parseGraffitiObjectResponse(
      response,
      location,
      false,
    );
    this.localChanges.patch(patch, oldObject);
    return oldObject;
  }

  listChannels(options?: {
    pods?: string[];
    fetch?: typeof fetch;
    ifModifiedSince?: Date;
  }) {
    return this.linesFeed.streamMultiple(
      "list-channels",
      (line, pod) => {
        const partial = JSON.parse(line);
        if (!this.validateChannelResult(partial)) {
          throw new Error("Invalid channel result");
        }
        return {
          ...partial,
          lastModified: new Date(partial.lastModified),
          pod,
        };
      },
      options,
    );
  }

  listOrphans(options?: {
    pods?: string[];
    fetch?: typeof fetch;
    ifModifiedSince?: Date;
  }) {
    return this.linesFeed.streamMultiple(
      "list-orphans",
      (line, pod) => {
        const partial = JSON.parse(line);
        if (!this.validateOrphanResult(partial)) {
          throw new Error("Invalid orphan result");
        }
        return {
          ...partial,
          lastModified: new Date(partial.lastModified),
          pod,
        };
      },
      options,
    );
  }

  discoverLocalChanges(
    channels: string[],
    options?: {
      schema?: JSONSchema4;
      ifModifiedSince?: Date;
    },
  ) {
    return this.localChanges.discover(channels, options);
  }

  discover(
    channels: string[],
    options?: {
      pods?: string[];
      schema?: JSONSchema4;
      ifModifiedSince?: Date;
      fetch?: typeof fetch;
    },
  ) {
    const urlPath = encodeQueryParams("discover", {
      channels,
      schema: options?.schema,
    });

    return this.linesFeed.streamMultiple(
      urlPath,
      async (line, pod) => {
        const partial = JSON.parse(line);
        if (!this.validateGraffitiObject(partial)) {
          throw new Error("Invalid graffiti object");
        }

        const object: GraffitiObject = {
          ...partial,
          pod,
          lastModified: new Date(partial.lastModified),
        };

        if (
          !(await this.delegation.hasPod(object.webId, object.pod, options))
        ) {
          throw new Error("Pod returned an object not authorized by its owner");
        }
        return object;
      },
      options,
    );
  }
}
