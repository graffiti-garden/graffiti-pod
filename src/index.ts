import Delegation from "./delegation";
import type {
  GraffitiLocation,
  GraffitiObjectBase,
  GraffitiPatch,
  GraffitiObject,
  GraffitiLocalObject,
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
  POD_ANNOUNCE_SCHEMA,
} from "./schemas";

export * from "./types";
export type { JSONSchema4 };

/**
 * The main class for interacting with the Graffiti API.
 * We recommend accessing the class via the singleton instance
 * provided by { @link useGraffiti } to maintain a global cache
 * and reactivity.
 */
export class GraffitiClient {
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

  bootstrapPods: string[] = ["https://pod.graffiti.garden"];

  constructor(options?: { bootstrapPods?: string[] }) {
    if (options?.bootstrapPods) {
      this.bootstrapPods = options.bootstrapPods;
    }
  }

  /**
   * An alias of {@link locationToUrl}.
   * @group Utilities
   */
  locationToUrl(location: GraffitiLocation): string {
    return locationToUrl(location);
  }
  /**
   * An alias of {@link locationToUrl}
   * @group Utilities
   */
  objectToUrl(object: GraffitiObjectBase): string {
    return this.locationToUrl(object);
  }
  /**
   * An alias of {@link urlToLocation}.
   * @group Utilities
   */
  urlToLocation(url: string): GraffitiLocation {
    return urlToLocation(url);
  }

  private whichFetch(session?: { fetch?: typeof fetch }) {
    return session?.fetch ?? fetch;
  }

  /**
   * PUTs a new object to the given location specified by a `webId`, `name`,
   * and `pod` or equivalently a Graffiti URL. If no `name` is provided,
   * a random one will be generated.
   *
   * The supplied object must contain a `value`, `channels`, and optionally
   * an access control list (`acl`). It is also type-checked against the
   * [JSON schema](https://json-schema.org/) that can be optionally provided
   * as the generic type parameter. We highly recommend providing a schema to
   * ensure that the PUT object matches subsequent {@link get} or {@link discover}
   * operations.
   *
   * An authenticated `fetch` function must be provided in the `session` object.
   * See {@link GraffitiSession} for more information.
   *
   * The previous object at the location will be returned if it exists.
   *
   * @group REST Operations
   */
  async put<Schema>(
    object: GraffitiLocalObject<Schema>,
    location: GraffitiLocation,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase>;
  async put<Schema>(
    object: GraffitiLocalObject<Schema>,
    url: string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase>;
  async put<Schema>(
    object: GraffitiLocalObject<Schema>,
    session: { fetch: typeof fetch; pod: string; webId: string },
  ): Promise<GraffitiObjectBase>;
  async put<Schema>(
    object: GraffitiLocalObject<Schema>,
    locationOrUrlOrSession:
      | string
      | { name?: string; pod: string; webId: string; fetch?: typeof fetch },
    session?: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase> {
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
        // Convert it to base64
        const base64 = btoa(String.fromCodePoint(...bytes));
        // Make sure it is url safe
        name = base64
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/\=+$/, "");
      }

      location = { webId, pod, name };
      url = this.locationToUrl(location);

      if (fetch_) fetch = fetch_;
    }

    if (
      !(
        "podAnnounce" in object.value &&
        typeof object.value.podAnnounce === "string"
      )
    ) {
      // See if we've already announced the pod, if not announce it
      const announcedToPods = new Set<string>();
      for await (const podAnnounce of this.discover(
        object.channels,
        {
          properties: {
            webId: { enum: [location.webId] },
            value: {
              required: ["podAnnounce"],
              properties: {
                podAnnounce: { enum: [location.pod] },
              },
            },
          },
        } as const,
        {
          webId: location.webId,
          fetch,
        },
        {
          pods: this.bootstrapPods,
        },
      )) {
        if (podAnnounce.error) continue;
        announcedToPods.add(podAnnounce.value.pod);
      }

      const unannouncedToPods = this.bootstrapPods.filter(
        (pod) => !announcedToPods.has(pod),
      );

      const announcements = unannouncedToPods.map(async (pod) => {
        await this.put<typeof POD_ANNOUNCE_SCHEMA>(
          {
            value: { podAnnounce: location.pod },
            channels: object.channels,
          },
          {
            fetch,
            webId: location.webId,
            pod,
          },
        );
      });
      await Promise.all(announcements);
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

  /**
   * GETs an object from the given location specified by a `webId`, `name`,
   * and `pod` or equivalently a Graffiti URL.
   *
   * The object is type-checked against the provided [JSON schema](https://json-schema.org/).
   *
   * An authenticated fetch function must be provided in the `session` object
   * to GET access-controlled objects. See {@link GraffitiSession} for more
   * information.
   *
   * @group REST Operations
   */
  async get<Schema extends JSONSchema4>(
    location: GraffitiLocation,
    schema: Schema,
    session?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject<Schema>>;
  async get<Schema extends JSONSchema4>(
    url: string,
    schema: Schema,
    session?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject<Schema>>;
  async get<Schema extends JSONSchema4>(
    locationOrUrl: GraffitiLocation | string,
    schema: Schema,
    session?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject<Schema>> {
    const { location, url } = parseLocationOrUrl(locationOrUrl);
    if (
      !(await this.delegation.hasPod(location.webId, location.pod, session))
    ) {
      throw new Error(
        `The Graffiti pod ${location.pod} is not registered with the WebID ${location.webId}`,
      );
    }
    const response = await this.whichFetch(session)(url);

    const object = await parseGraffitiObjectResponse(response, location, true);

    const validate = this.ajv.compile(schema);
    if (!validate(object)) {
      throw new Error("The fetched object does not match the provided schema.");
    }
    return object;
  }

  /**
   * DELETEs an object from the given location specified by a `webId`, `name`,
   * and `pod` or equivalently a Graffiti URL.
   *
   * An authenticated fetch function must be provided in the `session` object.
   * See {@link GraffitiSession} for more information.
   *
   * The previous object at the location will be returned if it exists.
   *
   * @group REST Operations
   */
  async delete(
    location: GraffitiLocation,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase>;
  async delete(
    url: string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase>;
  async delete(
    locationOrUrl: GraffitiLocation | string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase> {
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

  /**
   * PATCHes an object at the given location specified by a `webId`, `name`,
   * and `pod` or equivalently a Graffiti URL.
   *
   * The patch must be an object containing at least one of three optional
   * fields: `value`, `channels`, and `acl`. Each of these fields must be
   * a [JSON Patch](https://jsonpatch.com) array of operations.
   *
   * An authenticated fetch function must be provided in the `session` object.
   * See {@link GraffitiSession} for more information.
   *
   * The previous object at the location will be returned if it exists.
   *
   * @group REST Operations
   */
  async patch(
    patch: GraffitiPatch,
    location: GraffitiLocation,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase>;
  async patch(
    patch: GraffitiPatch,
    url: string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase>;
  async patch(
    patch: GraffitiPatch,
    locationOrUrl: GraffitiLocation | string,
    session: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase> {
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

  /**
   * Returns a list of all channels a user has posted to.
   * This is likely not very useful for most applications, but
   * necessary for certain applications where a user wants a
   * global view of all their Graffiti data.
   *
   * Error messages are returned in the stream rather than thrown
   * to prevent one unstable pod from breaking the entire stream.
   *
   * @group Query Operations
   */
  listChannels(
    session: {
      fetch: typeof fetch;
      webId: string;
    },
    options?: {
      pods?: string[];
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
      options?.pods ?? this.delegation.getPods(session.webId, session),
      session,
      options,
    );
  }

  /**
   * Returns a list of all objects a user has posted that are
   * not associated with any channel, i.e. orphaned objects.
   * This is likely not very useful for most applications, but
   * necessary for certain applications where a user wants a
   * global view of all their Graffiti data.
   *
   * Error messages are returned in the stream rather than thrown
   * to prevent one unstable pod from breaking the entire stream.
   *
   * @group Query Operations
   */
  listOrphans(
    session: {
      fetch: typeof fetch;
      webId: string;
    },
    options?: {
      pods?: string[];
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
      options?.pods ?? this.delegation.getPods(session.webId, session),
      session,
      options,
    );
  }

  /**
   * Returns a stream of objects that match the given [JSON Schema](https://json-schema.org)
   * and are contained in at least one of the given `channels`.
   *
   * Unlike {@link discover}, which queries external pods, this function listens
   * for changes made locally via {@link put}, {@link patch}, and {@link delete}.
   * Additionally, unlike {@link discover}, it does not return a one-time snapshot
   * of objects, but rather streams object changes as they occur. This is useful
   * for updating a UI in real-time without unnecessary polling.
   *
   * @group Query Operations
   */
  discoverLocalChanges<Schema extends JSONSchema4>(
    channels: string[],
    schema: Schema,
    options?: {
      ifModifiedSince?: Date;
    },
  ) {
    return this.localChanges.discover(channels, schema, options);
  }

  /**
   * Returns a stream of objects that match the given [JSON Schema](https://json-schema.org)
   * and are contained in at least one of the given `channels`.
   *
   * Objects are returned asynchronously as they are discovered but the stream
   * will end once all objects that currently exist have been discovered. So,
   * this function must be polled again for new objects, but it includes significant
   * caching to reduce network usage.
   *
   * These objects are fetched from the `pods` specified in the `session`,
   * and a `webId` and `fetch` function may also be provided to retrieve
   * access-controlled objects. See {@link GraffitiSession} for more information.
   *
   * Error messages are returned in the stream rather than thrown
   * to prevent one unstable pod from breaking the entire stream.
   *
   * @group Query Operations
   */
  discover<Schema extends JSONSchema4>(
    channels: string[],
    schema: Schema,
    session?:
      | {
          fetch: typeof fetch;
          webId: string;
        }
      | {
          fetch?: undefined;
          webId?: undefined;
        },
    options?: {
      pods?: string[];
      ifModifiedSince?: Date;
    },
  ): ReturnType<typeof this.linesFeed.streamMultiple<GraffitiObject<Schema>>> {
    const urlPath = encodeQueryParams("discover", {
      channels,
      schema,
    });

    let podIterator: AsyncGenerator<string, void, void> | string[];

    if (options?.pods) {
      podIterator = options.pods;
    } else {
      const podAnnounceIterator = this.discover(
        channels,
        POD_ANNOUNCE_SCHEMA,
        session,
        {
          ...options,
          pods: this.bootstrapPods,
        },
      );
      async function* podIteratorFn() {
        const seenPods = new Set<string>();
        for await (const podAnnounce of podAnnounceIterator) {
          if (podAnnounce.error) continue;
          const pod = podAnnounce.value.value.podAnnounce;
          if (seenPods.has(pod)) continue;
          seenPods.add(pod);
          yield pod;
        }
      }
      podIterator = podIteratorFn();
    }

    const validate = this.ajv.compile(schema);

    return this.linesFeed.streamMultiple<GraffitiObject<Schema>>(
      urlPath,
      async (line, pod) => {
        const partial = JSON.parse(line);
        if (!this.validateGraffitiObject(partial)) {
          throw new Error("Invalid graffiti object");
        }

        const object: GraffitiObjectBase = {
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
      podIterator,
      session,
      options,
    );
  }
}

export default GraffitiClient;

let graffiti: GraffitiClient | undefined = undefined;
/**
 * Returns a singleton instance of the {@link GraffitiClient} class
 * for global cache-reuse.
 */
export function useGraffiti(): GraffitiClient {
  if (!graffiti) {
    graffiti = new GraffitiClient();
  }
  return graffiti;
}
