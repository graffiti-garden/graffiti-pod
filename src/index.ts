import Delegation from "./delegation";
import type {
  GraffitiLocalObject,
  GraffitiLocation,
  GraffitiObject,
  GraffitiPatch,
} from "./types";
import type { JSONSchema4 } from "json-schema";
import {
  parseGraffitiObjectResponse,
  fetchJSONLines,
} from "./response-parsers";
import { locationToUrl, urlToLocation, parseLocationOrUrl } from "./types";
import {
  encodeACL,
  encodeChannels,
  encodeIfModifiedSince,
  encodeJSONBody,
  encodeSkipLimit,
} from "./header-encoders";
import { Repeater } from "@repeaterjs/repeater";
import LocalChanges from "./local-changes";

export { GraffitiLocalObject, GraffitiLocation, GraffitiObject, GraffitiPatch };

export default class GraffitiClient {
  readonly delegation = new Delegation();
  private readonly localChanges = new LocalChanges();

  webId: undefined | string = undefined;
  homePod: undefined | string = undefined;
  fetch: typeof fetch = fetch;

  setFetch(fetch_?: typeof fetch) {
    this.fetch = fetch_ ?? fetch;
    this.delegation.setFetch(fetch_);
  }

  setWebId(webId?: string) {
    this.webId = webId;
  }

  setHomePod(pod?: string) {
    this.homePod = pod;
  }

  private whichFetch(options?: { fetch?: typeof fetch }) {
    return options?.fetch ?? this.fetch;
  }

  private whichWebId(webId?: string) {
    return webId ?? this.webId;
  }

  private whichPod(pod?: string) {
    return pod ?? this.homePod;
  }

  locationToUrl(location: GraffitiLocation): string {
    return locationToUrl(location);
  }
  urlToLocation(url: string): GraffitiLocation {
    return urlToLocation(url);
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
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async put(
    object: GraffitiLocalObject,
    url?: string,
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject>;
  async put(
    object: GraffitiLocalObject,
    locationOrUrl?: string | { name?: string; pod?: string; webId?: string },
    options?: { fetch?: typeof fetch },
  ): Promise<GraffitiObject> {
    let location: GraffitiLocation;
    let url: string;

    if (typeof locationOrUrl === "string") {
      const parsed = parseLocationOrUrl(locationOrUrl);
      location = parsed.location;
      url = parsed.url;
    } else {
      let { webId, name, pod } = locationOrUrl ?? {};
      webId = this.whichWebId(webId);
      if (!webId) {
        throw new Error(
          "no webId provided. either use setWebId to provide a global webId or provide a webId in the location",
        );
      }
      pod = this.whichPod(pod);
      if (!pod) {
        throw new Error(
          "no pod provided. either use setHomePod to provide a global pod or provide a pod in the location",
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
    if (object["channels"]) {
      encodeChannels(requestInit, object["channels"]);
    }
    if (object["acl"]) {
      encodeACL(requestInit, object["acl"]);
    }
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
    const response = await this.whichFetch(options)(url, requestInit);
    const oldObject = await parseGraffitiObjectResponse(
      response,
      location,
      false,
    );
    this.localChanges.patch(patch, oldObject);
    return oldObject;
  }

  private async *listSinglePod(
    listType: string,
    pod: string,
    options?: Parameters<ReturnType<GraffitiClient["list"]>>[0],
  ): AsyncGenerator<
    | {
        error: false;
        value: any;
      }
    | {
        error: true;
        message: string;
        pod: string;
      },
    void,
    void
  > {
    const requestInit: RequestInit = { method: "POST" };
    if (options?.ifModifiedSince) {
      encodeIfModifiedSince(requestInit, options.ifModifiedSince);
    }
    for await (const result of fetchJSONLines(
      this.whichFetch(options),
      pod + "/list-" + listType,
      requestInit,
    )) {
      if (result.error) {
        yield { ...result, pod };
      } else {
        yield {
          error: false,
          value: {
            ...result.value,
            pod,
          },
        };
      }
    }
  }

  private list(listType: string) {
    const this_ = this;
    return async function* (options?: {
      webId?: string;
      pods?: string[];
      fetch?: typeof fetch;
      ifModifiedSince?: Date;
    }): AsyncGenerator<
      | {
          error: false;
          value: any;
        }
      | {
          error: true;
          message: string;
          pod?: string;
        },
      void,
      void
    > {
      let pods: string[];
      if (options?.pods) {
        pods = options.pods;
      } else {
        const webId = this_.whichWebId(options?.webId);
        if (webId) {
          pods = await this_.delegation.getPods(webId);
        } else {
          yield {
            error: true,
            message: "Either webId or pods must be provided",
          };
          return;
        }
      }

      const iterators = pods.map((pod) =>
        this_.listSinglePod(listType, pod, options),
      );
      for await (const json of Repeater.merge(iterators)) {
        yield json;
      }
    };
  }

  listChannels(
    ...args: Parameters<ReturnType<GraffitiClient["list"]>>
  ): AsyncGenerator<
    | {
        error: false;
        value: {
          channel: string;
          count: number;
          lastModified: Date;
          pod: string;
        };
      }
    | {
        error: true;
        message: string;
        pod?: string;
      },
    void,
    void
  > {
    // TODO: validate the return type
    return this.list("channels")(...args);
  }

  listOrphans(
    ...args: Parameters<ReturnType<GraffitiClient["list"]>>
  ): AsyncGenerator<
    | {
        error: false;
        value: {
          name: string;
          tombstone: boolean;
          lastModified: Date;
          pod: string;
        };
      }
    | {
        error: true;
        message: string;
        pod?: string;
      },
    void,
    void
  > {
    // TODO: validate the return type
    return this.list("orphans")(...args);
  }

  private async *querySinglePod(
    channels: string[],
    pod: string,
    options?: Parameters<GraffitiClient["query"]>[1],
  ): AsyncGenerator<
    | {
        error: false;
        value: GraffitiObject;
      }
    | {
        error: true;
        message: string;
        pod: string;
      },
    void,
    void
  > {
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

    for await (const result of fetchJSONLines(
      this.whichFetch(options),
      pod,
      requestInit,
    )) {
      if (result.error) {
        yield { ...result, pod };
      } else {
        // TODO: validation of the JSON object!!
        const output = {
          error: false,
          value: {
            ...result.value,
            pod,
          },
        } as const;

        // Only yield the object if the owner has
        // authorized the graffiti pod to host for them.
        if (
          await this.delegation.hasPod(
            output.value.webId,
            output.value.pod,
            options,
          )
        ) {
          yield output;
        } else {
          yield {
            error: true,
            message: `Pod returned an object not authorized by its owner, ${output.value.webId}`,
            pod,
          };
        }
      }
    }
  }

  async *queryLocalChanges(
    channels: string[],
    options?: {
      query?: JSONSchema4;
      ifModifiedSince?: Date;
    },
  ): AsyncGenerator<GraffitiObject, void, void> {
    for await (const object of this.localChanges.query(channels, options)) {
      yield object;
    }
  }

  async *query(
    channels: string[],
    options?: {
      pods?: string[];
      query?: JSONSchema4;
      ifModifiedSince?: Date;
      limit?: number;
      skip?: number;
      fetch?: typeof fetch;
    },
  ): AsyncGenerator<
    | {
        error: false;
        value: GraffitiObject;
      }
    | {
        error: true;
        message: string;
        pod?: string;
      },
    void,
    void
  > {
    let pods = options?.pods;

    // Try adding pods
    if (!pods) {
      const myPods = new Set<string>();

      const homePod = this.whichPod();
      if (homePod) myPods.add(homePod);

      const webId = this.whichWebId();
      if (webId) {
        (await this.delegation.getPods(webId)).forEach((pod) =>
          myPods.add(pod),
        );
      }

      if (myPods.size > 0) {
        pods = Array.from(myPods);
      }
    }

    if (!pods) {
      yield {
        error: true,
        message:
          "At this time, the DHT is not active and a list of pods must be provided",
      };
      return;
    }
    const iterators = pods.map((pod) =>
      this.querySinglePod(channels, pod, options),
    );
    for await (const object of Repeater.merge(iterators)) {
      yield object;
    }
  }
}
