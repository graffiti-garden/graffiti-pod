import Delegation from "./delegation";
import type {
  GraffitiLocalObject,
  GraffitiLocation,
  GraffitiObject,
  GraffitiPatch,
  GraffitiObjectTyped,
  GraffitiLocalObjectTyped,
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

export type * from "./types";
export type { JSONSchema4 };

export default class GraffitiClient {
  readonly delegation = new Delegation();
  private readonly linesFeed = new LinesFeed();
  private ajv = new Ajv({
    strictTypes: false,
  });
  private readonly localChanges = new LocalChanges(this.ajv);
  private readonly validateGraffitiObject = this.ajv.compile(
    GRAFFITI_OBJECT_SCHEMA,
  );
  private readonly validateOrphanResult =
    this.ajv.compile(ORPHAN_RESULT_SCHEMA);
  private readonly validateChannelResult = this.ajv.compile(
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

  private whichFetch(session?: { fetch?: typeof fetch }) {
    return session?.fetch ?? fetch;
  }

  async put<Schema>(
    object: GraffitiLocalObjectTyped<Schema>,
    location: GraffitiLocation,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObject>;
  async put<Schema>(
    object: GraffitiLocalObjectTyped<Schema>,
    url: string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObject>;
  async put<Schema>(
    object: GraffitiLocalObjectTyped<Schema>,
    session: { fetch: typeof fetch; pod: string; webId: string },
  ): Promise<GraffitiObject>;
  async put<Schema>(
    object: GraffitiLocalObjectTyped<Schema>,
    locationOrUrlOrSession:
      | string
      | { name?: string; pod: string; webId: string; fetch?: typeof fetch },
    session?: { fetch: typeof fetch },
  ): Promise<GraffitiObject> {
    let location: GraffitiLocation;
    let url: string;
    let fetch = this.whichFetch(session);

    if (typeof locationOrUrlOrSession === "string") {
      const parsed = parseLocationOrUrl(locationOrUrlOrSession);
      location = parsed.location;
      url = parsed.url;
    } else {
      let { webId, name, pod, fetch: fetch_ } = locationOrUrlOrSession ?? {};
      if (!webId) {
        throw new Error(
          "no webId provided to PUT either via the location or session.",
        );
      }
      if (!pod) {
        throw new Error(
          "no pod provided to PUT either via the location or session.",
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

      if (fetch_) fetch = fetch_;
    }

    await this.delegation.addPod(location.webId, location.pod, session);
    const requestInit: RequestInit = { method: "PUT" };
    encodeJSONBody(requestInit, object.value);

    url = encodeQueryParams(url, object);
    const response = await fetch(url, requestInit);
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
    session?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async get(
    url: string,
    session?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async get(
    locationOrUrl: GraffitiLocation | string,
    session?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject> {
    const { location, url } = parseLocationOrUrl(locationOrUrl);
    if (
      !(await this.delegation.hasPod(location.webId, location.pod, session))
    ) {
      throw new Error(
        `The Graffiti pod ${location.pod} is not registered with the WebID ${location.webId}`,
      );
    }
    const response = await this.whichFetch(session)(url);
    return parseGraffitiObjectResponse(response, location, true);
  }

  async delete(
    location: GraffitiLocation,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObject>;
  async delete(
    url: string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObject>;
  async delete(
    locationOrUrl: GraffitiLocation | string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObject> {
    const { location, url } = parseLocationOrUrl(locationOrUrl);
    const response = await this.whichFetch(session)(url, {
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
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObject>;
  async patch(
    patch: GraffitiPatch,
    url: string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObject>;
  async patch(
    patch: GraffitiPatch,
    locationOrUrl: GraffitiLocation | string,
    session: { fetch: typeof fetch },
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
    const response = await this.whichFetch(session)(urlWithQuery, requestInit);
    const oldObject = await parseGraffitiObjectResponse(
      response,
      location,
      false,
    );
    this.localChanges.patch(patch, oldObject);
    return oldObject;
  }

  listChannels(
    session: {
      pods: string[];
      fetch: typeof fetch;
      webId: string;
    },
    options?: {
      ifModifiedSince?: Date;
    },
  ) {
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
      session,
      options,
    );
  }

  listOrphans(
    session: {
      pods: string[];
      fetch: typeof fetch;
      webId: string;
    },
    options?: {
      ifModifiedSince?: Date;
    },
  ) {
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
      session,
      options,
    );
  }

  discoverLocalChanges<Schema extends JSONSchema4>(
    channels: string[],
    schema: Schema,
    options?: {
      ifModifiedSince?: Date;
    },
  ) {
    return this.localChanges.discover(channels, schema, options);
  }

  discover<Schema extends JSONSchema4>(
    channels: string[],
    schema: Schema,
    session: {
      pods: string[];
    } & (
      | {
          fetch: typeof fetch;
          webId: string;
        }
      | {
          fetch?: undefined;
          webId?: undefined;
        }
    ),
    options?: {
      ifModifiedSince?: Date;
    },
  ) {
    const urlPath = encodeQueryParams("discover", {
      channels,
      schema,
    });

    const validate = this.ajv.compile(schema);

    return this.linesFeed.streamMultiple<GraffitiObjectTyped<Schema>>(
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

        if (!validate(object)) {
          throw new Error("Object does match schema");
        }

        if (
          !(await this.delegation.hasPod(object.webId, object.pod, session))
        ) {
          throw new Error("Pod returned an object not authorized by its owner");
        }
        return object;
      },
      session,
      options,
    );
  }
}
