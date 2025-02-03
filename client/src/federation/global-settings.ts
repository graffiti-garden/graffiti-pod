import type { JSONSchema4 } from "@graffiti-garden/api";
import {
  getProfileAll,
  getThing,
  saveSolidDatasetAt,
  setThing,
  getSourceUrl,
  createThing,
  universalAccess,
  type ThingPersisted,
  getUrl,
  setUrl,
  removeAll,
} from "@inrupt/solid-client";

const GRAFFITI_PREDICATE = "https://graffiti.garden";

export const USER_SETTINGS_SCHEMA = {
  type: "object",
  required: ["value"],
  properties: {
    value: {
      type: "object",
      required: ["settings"],
      properties: {
        settings: {
          type: "object",
          required: ["pods"],
          properties: {
            pods: {
              type: "array",
              items: {
                type: "object",
                required: ["pod"],
                properties: {
                  pod: { type: "string" },
                  delegateIfMatching: { type: "object", nullable: true },
                },
              },
            },
          },
        },
      },
    },
  },
} as const satisfies JSONSchema4;

export default class SettingsUrlManager {
  private readonly settingsUrlCache = new Map<string, string | null>();
  private readonly webIdLocks = new Map<string, Promise<any>>();

  private async getProfile(
    webId: string,
    session?: {
      fetch?: typeof fetch;
    },
  ) {
    const profiles = await getProfileAll(webId, {
      fetch: session?.fetch ?? fetch,
    });
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
    session: {
      fetch: typeof fetch;
    },
  ) {
    const profileNew = setThing(profile, profileThing);
    await saveSolidDatasetAt(getSourceUrl(profile), profileNew, session);
    await universalAccess.setPublicAccess(
      getSourceUrl(profileNew),
      {
        read: true,
        write: false,
        append: false,
        controlRead: false,
        controlWrite: false,
      },
      session,
    );
  }

  private async untilWebIdUnlocked(webId: string) {
    while (this.webIdLocks.has(webId)) {
      await this.webIdLocks.get(webId);
    }
  }

  private async lockWebIdToPromise<T>(webId: string, promise: Promise<T>) {
    this.webIdLocks.set(webId, promise);
    const output = await promise;
    this.webIdLocks.delete(webId);
    return output;
  }

  async getSettingsUrl(webId?: string, session?: { fetch?: typeof fetch }) {
    if (!webId) return null;
    await this.untilWebIdUnlocked(webId);
    const promise = (async () => {
      let settingsUrl = this.settingsUrlCache.get(webId);
      if (settingsUrl === undefined) {
        const { profileThing } = await this.getProfile(webId, session);
        settingsUrl = getUrl(profileThing, GRAFFITI_PREDICATE);
        this.settingsUrlCache.set(webId, settingsUrl);
      }
      return settingsUrl;
    })();
    return await this.lockWebIdToPromise(webId, promise);
  }

  async deleteSettingsUrl(webId: string, session: { fetch: typeof fetch }) {
    await this.untilWebIdUnlocked(webId);
    const promise = (async () => {
      const { profile, profileThing } = await this.getProfile(webId, session);
      const profileThingNew = removeAll(profileThing, GRAFFITI_PREDICATE);
      await this.saveProfile(profile, profileThingNew, session);
      this.settingsUrlCache.delete(webId);
    })();
    return await this.lockWebIdToPromise(webId, promise);
  }

  async setSettingsUrl(
    webId: string,
    settingsUrl: string,
    session: { fetch: typeof fetch },
  ) {
    await this.untilWebIdUnlocked(webId);
    const promise = (async () => {
      const { profile, profileThing } = await this.getProfile(webId, session);
      const profileThingNew = setUrl(
        profileThing,
        GRAFFITI_PREDICATE,
        settingsUrl,
      );
      await this.saveProfile(profile, profileThingNew, session);
      this.settingsUrlCache.set(webId, settingsUrl);
    })();
    return await this.lockWebIdToPromise(webId, promise);
  }
}
