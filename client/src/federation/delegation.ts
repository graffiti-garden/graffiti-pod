import type Ajv from "ajv";
import type { GraffitiLocalObject } from "./types";
import { USER_SETTINGS_SCHEMA, POD_ANNOUNCE_SCHEMA } from "./schemas";

export default class PodDelegation {
  constructor(private readonly ajv: Ajv) {}

  delegationFromSettings(
    settings: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>,
  ) {
    return settings.value.settings.pods as Array<{
      pod: string;
      delegateIfMatching?: {};
    }>;
  }

  allPods(settings: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>) {
    return [
      ...new Set(
        this.delegationFromSettings(settings).map(
          (delegatedPod) => delegatedPod.pod,
        ),
      ),
    ];
  }

  isPodDelegated(
    settings: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>,
    pod: string,
    object: {},
  ) {
    const delegation = this.delegationFromSettings(settings);
    const schemas = delegation
      .filter((delegatedPod) => delegatedPod.pod === pod)
      .map((delegatedPod) => delegatedPod.delegateIfMatching);
    for (const schema of schemas) {
      if (!schema) continue;
      const validateObject = this.ajv.compile(schema);
      if (validateObject(object)) {
        return true;
      }
    }
    return false;
  }

  whichPodDelegated(
    settings: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>,
    object: {},
  ) {
    const delegation = this.delegationFromSettings(settings);
    for (const { pod, delegateIfMatching } of delegation) {
      if (!delegateIfMatching) continue;
      const validateObject = this.ajv.compile(delegateIfMatching);
      if (validateObject(object)) {
        return pod;
      }
    }
    return null;
  }

  announceToPods(
    podAnnounce: string,
    channels: string[],
    settings: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>,
  ) {
    const delegation = this.delegationFromSettings(settings);
    const announceObject: GraffitiLocalObject<typeof POD_ANNOUNCE_SCHEMA> = {
      value: { podAnnounce },
      channels,
    };
    const pods = delegation.reduce<string[]>(
      (acc, { pod, delegateIfMatching }) => {
        if (!delegateIfMatching) return acc;
        const validateObject = this.ajv.compile(delegateIfMatching);
        if (validateObject(announceObject)) {
          acc.push(pod);
        }
        return acc;
      },
      [],
    );
    return [...new Set(pods)];
  }
}
