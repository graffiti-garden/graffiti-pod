import PodManager from "./pod-manager";
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

export { GraffitiLocalObject, GraffitiLocation, GraffitiObject, GraffitiPatch };

export default class GraffitiClient {
  readonly podManager = new PodManager();

  locationToUrl(location: GraffitiLocation): string {
    return locationToUrl(location);
  }
  urlToLocation(url: string): GraffitiLocation {
    return urlToLocation(url);
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
    const { location, url } = parseLocationOrUrl(locationOrUrl);
    await this.podManager.addPod(location.webId, location.pod, options);
    const requestInit: RequestInit = { method: "PUT" };
    encodeJSONBody(requestInit, object.value);
    if (object["channels"]) {
      encodeChannels(requestInit, object["channels"]);
    }
    if (object["acl"]) {
      encodeACL(requestInit, object["acl"]);
    }
    const response = await (options?.fetch ?? fetch)(url, requestInit);
    return parseGraffitiObjectResponse(response, location, false);
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
      !(await this.podManager.hasPod(location.webId, location.pod, options))
    ) {
      throw new Error(
        `The Graffiti pod ${location.pod} is not registered with the WebID ${location.webId}`,
      );
    }
    const response = await (options?.fetch ?? fetch)(url);
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
    const response = await (options?.fetch ?? fetch)(url, {
      method: "DELETE",
    });
    return parseGraffitiObjectResponse(response, location, false);
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
    return parseGraffitiObjectResponse(response, location, false);
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
      options?.fetch,
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
      } else if (options?.webId) {
        pods = await this_.podManager.getPods(options.webId);
      } else {
        yield {
          error: true,
          message: "Either webId or pods must be provided",
        };
        return;
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
      options?.fetch,
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
          await this.podManager.hasPod(
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
    if (!options?.pods) {
      yield {
        error: true,
        message:
          "At this time, the DHT is not active and a list of pods must be provided",
      };
      return;
    }
    const iterators = options.pods.map((pod) =>
      this.querySinglePod(channels, pod, options),
    );
    for await (const object of Repeater.merge(iterators)) {
      yield object;
    }
  }
}
