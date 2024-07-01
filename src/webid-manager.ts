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
  ThingPersisted,
} from "@inrupt/solid-client";

const POD_PREDICATE = "https://graffiti.garden/ns/graffitiPod";

export default class WebIdManager {
  private podCache = new Map<string, string[]>();

  private async getProfile(
    webId: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const profiles = await getProfileAll(webId, options);
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
    await saveSolidDatasetAt(getSourceUrl(profile), profileNew, options);
    await universalAccess.setPublicAccess(
      getSourceUrl(profileNew),
      {
        read: true,
        write: false,
        append: false,
        controlRead: false,
        controlWrite: false,
      },
      options,
    );
  }

  private extractAndCacheGraffitiPods(
    webId: string,
    profileThing: ThingPersisted,
  ) {
    const pods = getUrlAll(profileThing, POD_PREDICATE);
    this.podCache.set(webId, pods);
    return pods;
  }

  async getGraffitiPods(
    webId: string,
    options?: {
      fetch?: typeof fetch;
    },
  ): Promise<string[]> {
    const existingPods = this.podCache.get(webId);
    if (existingPods) return existingPods;
    const { profileThing } = await this.getProfile(webId, options);
    return this.extractAndCacheGraffitiPods(webId, profileThing);
  }

  async hasGraffitiPod(
    webId: string,
    graffitiPod: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const pods = await this.getGraffitiPods(webId, options);
    return pods.includes(graffitiPod);
  }

  async addGraffitiPod(
    webId: string,
    graffitiPod: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const { profile, profileThing } = await this.getProfile(webId, options);
    if (getUrlAll(profileThing, POD_PREDICATE).includes(graffitiPod)) {
      return;
    }
    const profileThingNew = addUrl(profileThing, POD_PREDICATE, graffitiPod);
    await this.saveProfile(profile, profileThingNew, options);
    this.extractAndCacheGraffitiPods(webId, profileThingNew);
  }

  async removeGraffitiPod(
    webId: string,
    graffitiPod: string,
    options?: {
      fetch?: typeof fetch;
    },
  ) {
    const { profile, profileThing } = await this.getProfile(webId, options);
    if (!getUrlAll(profileThing, POD_PREDICATE).includes(graffitiPod)) {
      return;
    }
    const profileThingNew = removeUrl(profileThing, POD_PREDICATE, graffitiPod);
    await this.saveProfile(profile, profileThingNew, options);
    this.extractAndCacheGraffitiPods(webId, profileThingNew);
  }
}
