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
  ThingPersisted,
  universalAccess,
} from "@inrupt/solid-client";

const POD_PREDICATE = "https://graffiti.garden/ns/graffitiPod";

export default class WebIdManager {
  // TODO!
  // private podCache = new Map<string, string[]>();

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

  async getGraffitiPods(
    webId: string,
    options?: {
      fetch?: typeof fetch;
    },
  ): Promise<string[]> {
    const { profileThing } = await this.getProfile(webId, options);
    return getUrlAll(profileThing, POD_PREDICATE);
  }

  async addGraffitiPod(
    webId: string,
    graffitiPod: string,
    options: {
      fetch: typeof fetch;
    },
  ) {
    const { profile, profileThing } = await this.getProfile(webId, options);
    if (getUrlAll(profileThing, POD_PREDICATE).includes(graffitiPod)) {
      return;
    }
    const profileThingNew = addUrl(profileThing, POD_PREDICATE, graffitiPod);
    await this.saveProfile(profile, profileThingNew, options);
  }

  async removeGraffitiPod(
    webId: string,
    graffitiPod: string,
    options: {
      fetch: typeof fetch;
    },
  ) {
    const { profile, profileThing } = await this.getProfile(webId, options);
    if (!getUrlAll(profileThing, POD_PREDICATE).includes(graffitiPod)) {
      return;
    }
    const profileThingNew = removeUrl(profileThing, POD_PREDICATE, graffitiPod);
    await this.saveProfile(profile, profileThingNew, options);
  }
}
