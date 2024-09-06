import {
  getProfileAll,
  getThing,
  getUrlAll,
  removeUrl,
  saveSolidDatasetAt,
  addUrl,
  setThing,
  getSourceUrl,
  createThing,
  universalAccess,
  type ThingPersisted,
} from "@inrupt/solid-client";

const POD_PREDICATE = "https://graffiti.garden/ns/graffitiPod";

export default class Delegation {
  private readonly podCache = new Map<string, string[]>();

  private whichOptions(options?: { fetch?: typeof fetch }) {
    return {
      ...options,
      fetch: options?.fetch ?? fetch,
    };
  }

  private async getProfile(
    webId: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const profiles = await getProfileAll(webId, this.whichOptions(options));
    const profile = profiles.altProfileAll[0] ?? profiles.webIdProfile;
    const profileThing =
      getThing(profile, webId) ??
      createThing({
        url: webId,
      });
    return { profile, profileThing };
  }

  private async saveProfile(
    profile: Awaited<ReturnType<typeof this.getProfile>>["profile"],
    profileThing: ThingPersisted,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const profileNew = setThing(profile, profileThing);
    await saveSolidDatasetAt(
      getSourceUrl(profile),
      profileNew,
      this.whichOptions(options),
    );
    await universalAccess.setPublicAccess(
      getSourceUrl(profileNew),
      {
        read: true,
        write: false,
        append: false,
        controlRead: false,
        controlWrite: false,
      },
      this.whichOptions(options),
    );
  }

  private extractAndCachePods(webId: string, profileThing: ThingPersisted) {
    const pods = getUrlAll(profileThing, POD_PREDICATE);
    const uniquePods = Array.from(new Set(pods));
    this.podCache.set(webId, uniquePods);
    return pods;
  }

  async getPods(
    webId: string,
    options?: {
      fetch?: typeof fetch;
    },
  ): Promise<string[]> {
    const existingPods = this.podCache.get(webId);
    if (existingPods) return existingPods;
    const { profileThing } = await this.getProfile(webId, options);
    return this.extractAndCachePods(webId, profileThing);
  }

  async hasPod(
    webId: string,
    pod: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const pods = await this.getPods(webId, options);
    return pods.includes(pod);
  }

  async addPod(
    webId: string,
    pod: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    pod = new URL(pod).origin;
    const { profile, profileThing } = await this.getProfile(webId, options);
    if (getUrlAll(profileThing, POD_PREDICATE).includes(pod)) {
      return;
    }
    const profileThingNew = addUrl(profileThing, POD_PREDICATE, pod);
    await this.saveProfile(profile, profileThingNew, options);
    this.extractAndCachePods(webId, profileThingNew);
  }

  async removePod(
    webId: string,
    pod: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const { profile, profileThing } = await this.getProfile(webId, options);
    if (!getUrlAll(profileThing, POD_PREDICATE).includes(pod)) {
      return;
    }
    const profileThingNew = removeUrl(profileThing, POD_PREDICATE, pod);
    await this.saveProfile(profile, profileThingNew, options);
    this.extractAndCachePods(webId, profileThingNew);
  }
}
