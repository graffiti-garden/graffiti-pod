import SettingsUrlManager from "./settings-url";
import PodDelegation from "./pod-delegation";
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
import Ajv, { type JSONSchemaType } from "ajv";
import {
  GRAFFITI_OBJECT_SCHEMA,
  ORPHAN_RESULT_SCHEMA,
  CHANNEL_RESULT_SCHEMA,
  POD_ANNOUNCE_SCHEMA,
  USER_SETTINGS_SCHEMA,
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
  private readonly linesFeed = new LinesFeed();
  private ajv = new Ajv({
    strictTypes: false,
  });
  private readonly settingsUrlManager = new SettingsUrlManager();
  private readonly localChanges = new LocalChanges(this.ajv);
  private readonly podDelegation = new PodDelegation(this.ajv);
  private readonly validateGraffitiObject = this.ajv.compile(
    GRAFFITI_OBJECT_SCHEMA,
  );
  private readonly validateOrphanResult =
    this.ajv.compile(ORPHAN_RESULT_SCHEMA);
  private readonly validateChannelResult = this.ajv.compile(
    CHANNEL_RESULT_SCHEMA,
  );

  readonly defaultUserSettings: GraffitiLocalObject<
    typeof USER_SETTINGS_SCHEMA
  > = {
    channels: [],
    value: {
      settings: {
        pods: [
          {
            pod: "https://pod.graffiti.garden",
            delegateIfMatching: {},
          },
        ],
      },
    },
  };

  constructor(options?: {
    defaultUserSettings?: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>;
  }) {
    if (options?.defaultUserSettings) {
      this.defaultUserSettings = options.defaultUserSettings;
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

  getUserSettingsUrl(
    ...args: Parameters<SettingsUrlManager["getSettingsUrl"]>
  ) {
    return this.settingsUrlManager.getSettingsUrl(...args);
  }
  setUserSettingsUrl(
    ...args: Parameters<SettingsUrlManager["setSettingsUrl"]>
  ) {
    return this.settingsUrlManager.setSettingsUrl(...args);
  }
  deleteUserSettingsUrl(
    ...args: Parameters<SettingsUrlManager["deleteSettingsUrl"]>
  ) {
    return this.settingsUrlManager.deleteSettingsUrl(...args);
  }
  async getUserSettingsWithDefaults(
    settingsUrl: string | null,
    session?: {
      fetch?: typeof fetch;
    },
  ): Promise<GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>> {
    if (!settingsUrl) return this.defaultUserSettings;
    try {
      return await this.get(settingsUrl, USER_SETTINGS_SCHEMA, session);
    } catch {
      return this.defaultUserSettings;
    }
  }

  /**
   * PUTs a new object to the given location specified by a `webId`, `name`,
   * and `pod` or equivalently a Graffiti URL. If no `name` is provided,
   * a random one will be generated. If no `pod` is provided, the first pod
   * listed in the user's settings with a schema that matches the object will
   * be used. If a `pod` is provided, it must be listed in the user's settings
   * with a schema that matches the object.
   *
   * The supplied object must contain a `value`, `channels`, and optionally
   * an access control list (`acl`) of webIds. It is also type-checked against the
   * [JSON schema](https://json-schema.org/) that can be optionally provided
   * as the generic type parameter. We highly recommend providing a schema to
   * ensure that the PUT object matches subsequent {@link get} or {@link discover}
   * operations.
   *
   * In addition to putting the specified object, this function will also PUT
   * "pod announcement" objects to each of the user's pods in any of the
   * object's channels that do not already contain such an announcement. This is
   * necessary to ensure that the object is discoverable by other users.
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
    session: { fetch: typeof fetch; webId: string; pod?: string },
  ): Promise<GraffitiObjectBase>;
  async put<Schema>(
    object: GraffitiLocalObject<Schema>,
    locationOrUrlOrSession:
      | string
      | { name?: string; pod?: string; webId: string; fetch?: typeof fetch },
    optionalSession?: { fetch: typeof fetch },
  ): Promise<GraffitiObjectBase> {
    let nameMaybe: string | undefined;
    let podMaybe: string | undefined;
    let session: { fetch: typeof fetch; webId: string };

    if (typeof locationOrUrlOrSession === "string") {
      const { location } = parseLocationOrUrl(locationOrUrlOrSession);
      nameMaybe = location.name;
      podMaybe = location.pod;
      session = {
        fetch: this.whichFetch(optionalSession),
        webId: location.webId,
      };
    } else {
      let { webId, name, pod, fetch: fetch_ } = locationOrUrlOrSession;
      session = { fetch: fetch_ ?? this.whichFetch(optionalSession), webId };
      nameMaybe = name;
      podMaybe = pod;
    }

    let name: string;
    if (nameMaybe) {
      name = nameMaybe;
    } else {
      // Generate a random name if none is provided
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Convert it to base64
      const base64 = btoa(String.fromCodePoint(...bytes));
      // Make sure it is url safe
      name = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=+$/, "");
    }

    // Get the user's settings URL
    const settingsUrl = await this.getUserSettingsUrl(session.webId, session);

    let pod: string;
    let announceToPods: string[];
    if (
      podMaybe &&
      locationToUrl({ name, webId: session.webId, pod: podMaybe }) ===
        settingsUrl
    ) {
      // The user is putting their user settings file itself
      // so don't try to get it to avoid recursion
      pod = podMaybe;
      const userSettingsType: JSONSchemaType<{
        value: {
          settings: {
            pods: Array<{
              pod: string;
              delegateIfMatching?: {};
            }>;
          };
        };
      }> = USER_SETTINGS_SCHEMA;
      const validation = this.ajv.compile(userSettingsType);
      if (!validation(object)) {
        throw new Error(
          "You're putting an object to your settings URL that is not valid settings",
        );
      }
      announceToPods = this.podDelegation.announceToPods(
        pod,
        object.channels,
        object,
      );
    } else {
      const settings = await this.getUserSettingsWithDefaults(
        settingsUrl,
        session,
      );

      if (podMaybe) {
        const isDelegated = this.podDelegation.isPodDelegated(
          settings,
          podMaybe,
          object,
        );
        if (!isDelegated) {
          throw new Error(
            `The pod ${podMaybe} is not delegated in your settings.`,
          );
        }
        pod = podMaybe;
      } else {
        const delegation = this.podDelegation.whichPodDelegated(
          settings,
          object,
        );

        if (!delegation) {
          throw new Error(
            "No delegated pod found for this object. Please edit your settings.",
          );
        } else {
          pod = delegation;
        }
      }

      announceToPods = this.podDelegation.announceToPods(
        pod,
        object.channels,
        settings,
      );
    }

    const location: GraffitiLocation = { name, pod, webId: session.webId };

    // Make the request
    const url = locationToUrl({ name, webId: session.webId, pod });
    const requestInit: RequestInit = { method: "PUT" };
    encodeJSONBody(requestInit, object.value);
    const putUrl = encodeQueryParams(url, object);
    const response = await session.fetch(putUrl, requestInit);
    const oldObject = await parseGraffitiObjectResponse(
      response,
      location,
      false,
    );
    this.localChanges.put(object, oldObject);

    // Pod announcements provide hints that point to the
    // pod where the object can be found from a set of
    // universally known "bootstrap" pods.
    //
    // If this is a pod announcement itself, we don't need
    // to do anything, otherwise we check if we've already
    // announced the pod and if not, announce it.
    if (
      !(
        "podAnnounce" in object.value &&
        typeof object.value.podAnnounce === "string"
      )
    ) {
      // Check if we've already announced this pod
      const announcedToChannelsPerPod = new Map<string, Set<string>>();
      for await (const podAnnounce of this.discover(
        object.channels,
        {
          properties: {
            tombstone: { enum: [false] },
            webId: { enum: [location.webId] },
            value: {
              required: ["podAnnounce"],
              properties: {
                podAnnounce: { enum: [location.pod] },
              },
            },
          },
        } as const,
        session,
        {
          pods: announceToPods,
        },
      )) {
        if (podAnnounce.error) continue;
        const pod = podAnnounce.value.pod;
        if (!announcedToChannelsPerPod.has(pod)) {
          announcedToChannelsPerPod.set(pod, new Set());
        }
        for (const channel of podAnnounce.value.channels) {
          announcedToChannelsPerPod.get(pod)!.add(channel);
        }
      }

      // Announce it if necessary
      const announcements: Promise<any>[] = [];
      for (const pod of announceToPods) {
        const channelsToAnnounce = announcedToChannelsPerPod.has(pod)
          ? object.channels.filter(
              (channel) => !announcedToChannelsPerPod.get(pod)!.has(channel),
            )
          : object.channels;
        if (channelsToAnnounce.length === 0) continue;
        announcements.push(
          this.put<typeof POD_ANNOUNCE_SCHEMA>(
            {
              value: { podAnnounce: location.pod },
              channels: channelsToAnnounce,
            },
            { ...session, pod },
          ),
        );
      }
      await Promise.all(announcements);
    }

    return oldObject;
  }

  /**
   * GETs an object from the given location specified by a `webId`, `name`,
   * and `pod` or equivalently a Graffiti URL.
   *
   * The object is type-checked against the provided [JSON schema](https://json-schema.org/).
   * The object is also verified to be delegated by it's owner's settings file
   * to its pod with a matching schema.
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
    const response = await this.whichFetch(session)(url);
    const object = await parseGraffitiObjectResponse(response, location, true);

    // Make sure the pod is delegated by the user
    const settingsUrl = await this.getUserSettingsUrl(location.webId, session);
    if (settingsUrl !== url) {
      const settings = await this.getUserSettingsWithDefaults(
        settingsUrl,
        session,
      );
      const isDelegated = this.podDelegation.isPodDelegated(
        settings,
        location.pod,
        object,
      );
      if (!isDelegated) {
        throw new Error(
          `The Graffiti pod ${location.pod} is not delegated by the WebID ${location.webId} for the following object:\n ${JSON.stringify(object, null, 2)}.`,
        );
      }
    }

    // Make sure it conforms to the provided schema
    const validate = this.ajv.compile(schema);
    if (!validate(object)) {
      throw new Error(
        `The following fetched object does not match the provided schema:\n ${JSON.stringify(object, null, 2)}.`,
      );
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

    // TODO: delete all hanging announcements
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
    // TODO: delete all hanging announcements
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
    const pods =
      options?.pods ??
      (async () => {
        const settings = await this.getUserSettingsWithDefaults(
          await this.getUserSettingsUrl(session.webId, session),
          session,
        );
        return this.podDelegation.allPods(settings);
      })();

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
      pods,
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
    const pods =
      options?.pods ??
      (async () => {
        const settings = await this.getUserSettingsWithDefaults(
          await this.getUserSettingsUrl(session.webId, session),
          session,
        );
        return this.podDelegation.allPods(settings);
      })();

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
      pods,
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
      const this_ = this;
      async function* podIteratorFn() {
        const seenPods = new Set<string>();
        const settings = await this_.getUserSettingsWithDefaults(
          await this_.getUserSettingsUrl(session?.webId, session),
          session,
        );
        const bootstrapPods = this_.podDelegation.allPods(settings);
        const podAnnounceIterator = this_.discover(
          channels,
          POD_ANNOUNCE_SCHEMA,
          session,
          {
            ...options,
            pods: bootstrapPods,
          },
        );
        for await (const podAnnounce of podAnnounceIterator) {
          if (podAnnounce.error || podAnnounce.value.tombstone) continue;
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

        const settings = await this.getUserSettingsWithDefaults(
          await this.getUserSettingsUrl(object.webId, session),
          session,
        );
        if (!this.podDelegation.isPodDelegated(settings, pod, object)) {
          throw new Error(
            `The pod ${pod} returned the following object not authorized by its owner:\n ${JSON.stringify(object, null, 2)}`,
          );
        }

        if (!validate(object)) {
          throw new Error("Object does match schema");
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
