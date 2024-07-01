import WebIdManager from "./webid-manager";

interface GraffitiLocation {
  name: string;
  webId: string;
  graffitiPod: string;
}

interface GraffitiLocalObject {
  value: any;
  channels?: string[];
  acl?: string[];
}

type GraffitiObject = GraffitiLocation &
  GraffitiLocalObject & {
    lastModified: Date;
  };

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

  private static async parseGraffitiObjectResponse(
    response: Response,
    location: GraffitiLocation,
  ): Promise<GraffitiObject> {
    if (!response.ok) {
      throw new Error(await response.text());
    }

    if (response.status === 201) {
      return {
        value: null,
        channels: [],
        lastModified: new Date(0),
        ...location,
      };
    } else {
      return {
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
}
