import type Ajv from "ajv";
import type { GraffitiLocalObject } from "./types";
import { USER_SETTINGS_SCHEMA } from "./schemas";

export default class PodDelegation {
  constructor(private readonly ajv: Ajv) {}

  delegationFromSettings(
    settings: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>,
  ) {
    return settings.value.podDelegation as Array<{
      pod: string;
      schema: {};
    }>;
  }

  allPodsDelegated(settings: GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>) {
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
      .map((delegatedPod) => delegatedPod.schema);
    for (const schema of schemas) {
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
    for (const { pod, schema } of delegation) {
      const validateObject = this.ajv.compile(schema);
      if (validateObject(object)) {
        return pod;
      }
    }
    return null;
  }
}
