import { it, expect } from "vitest";
import PodDelegation from "./pod-delegation";
import type { GraffitiLocalObject } from "./types";
import type { USER_SETTINGS_SCHEMA } from "./schemas";
import Ajv from "ajv";
import { randomString } from "./test-utils";

it("one pod delegates anything", async () => {
  const pod = `https://${randomString()}.com`;
  const settings = {
    value: {
      settings: {
        pods: [
          {
            pod,
            delegateIfMatching: {
              type: "object",
            },
          },
        ],
      },
    },
    channels: [],
  } satisfies GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>;

  const manager = new PodDelegation(new Ajv());
  expect(manager.isPodDelegated(settings, pod, {})).toBe(true);
  expect(
    manager.isPodDelegated(settings, pod, {
      something: "else",
      asdf: 1234,
      cool: ["beans", 69],
    }),
  ).toBe(true);
  expect(
    manager.isPodDelegated(settings, `https://${randomString()}.com`, {}),
  ).toBe(false);
});

it("one pod delegates some things, another pod delegates others", async () => {
  const pod1 = `https://${randomString()}.com`;
  const pod2 = `https://${randomString()}.com`;
  const settings = {
    value: {
      settings: {
        pods: [
          {
            pod: pod1,
            delegateIfMatching: {
              type: "object",
              properties: {
                something: { type: "string" },
              },
              required: ["something"],
            },
          },
          {
            pod: pod2,
            delegateIfMatching: {
              type: "object",
              properties: {
                otherthings: { type: "string" },
              },
              required: ["otherthings"],
            },
          },
          {
            pod: `https://${randomString()}.com`,
          },
        ],
      },
    },
    channels: [],
  } satisfies GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>;

  const manager = new PodDelegation(new Ajv());
  expect(
    manager.isPodDelegated(settings, pod1, {
      something: "else",
      whatever: "stuff",
    }),
  ).toBe(true);
  expect(
    manager.isPodDelegated(settings, pod1, {
      something: 1234,
    }),
  ).toBe(false);
  expect(
    manager.isPodDelegated(settings, pod1, {
      otherthings: "else",
    }),
  ).toBe(false);
  expect(
    manager.isPodDelegated(settings, pod2, {
      otherthings: "else",
    }),
  ).toBe(true);
  expect(
    manager.isPodDelegated(settings, pod2, {
      otherthings: {},
    }),
  ).toBe(false);
  expect(
    manager.isPodDelegated(settings, pod2, {
      something: "else",
    }),
  ).toBe(false);
});

it("which pod delegates what", async () => {
  const pod1 = `https://${randomString()}.com`;
  const pod2 = `https://${randomString()}.com`;

  const settings = {
    value: {
      settings: {
        pods: [
          {
            pod: pod1,
            delegateIfMatching: {
              type: "object",
              required: ["value"],
              properties: {
                value: {
                  type: "object",
                  properties: {
                    something: { type: "string" },
                  },
                  required: ["something"],
                },
              },
            },
          },
          {
            pod: `https://${randomString()}.com`,
          },
          {
            pod: pod2,
            delegateIfMatching: {
              type: "object",
              required: ["value"],
              properties: {
                value: {
                  type: "object",
                },
              },
            },
          },
        ],
      },
    },
    channels: [],
  } satisfies GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>;

  const manager = new PodDelegation(new Ajv());
  expect(
    manager.whichPodDelegated(settings, {
      value: {
        something: "cool",
      },
    }),
  ).toBe(pod1);
  expect(
    manager.whichPodDelegated(settings, {
      value: {
        anything: "else",
      },
    }),
  ).toBe(pod2);
  expect(
    manager.whichPodDelegated(settings, {
      noValue: {},
    }),
  ).toBe(null);
});

it("all pods", async () => {
  const pod1 = `https://${randomString()}.com`;
  const pod2 = `https://${randomString()}.com`;
  const pod3 = `https://${randomString()}.com`;
  const pod4 = `https://${randomString()}.com`;
  const settings = {
    value: {
      settings: {
        pods: [
          {
            pod: pod1,
            delegateIfMatching: {
              type: "object",
              required: ["something"],
              properties: {
                something: { type: "string" },
              },
            },
          },
          {
            pod: pod2,
            delegateIfMatching: {
              type: "object",
            },
          },
          {
            pod: pod4,
          },
          {
            pod: pod1,
            delegateIfMatching: {
              type: "object",
              required: ["value"],
              properties: {
                value: {
                  type: "object",
                },
              },
            },
          },
          {
            pod: pod3,
            schema: {
              type: "object",
              required: ["value"],
              properties: {
                value: {
                  type: "object",
                },
              },
            },
          },
        ],
      },
    },
    channels: [],
  } satisfies GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>;

  const manager = new PodDelegation(new Ajv());
  expect(manager.allPods(settings).sort()).toEqual(
    [pod1, pod2, pod3, pod4].sort(),
  );
});

it("announce to pods", async () => {
  const pod1 = `https://${randomString()}.com`;
  const pod2 = `https://${randomString()}.com`;
  const pod3 = `https://${randomString()}.com`;
  const settings = {
    value: {
      settings: {
        pods: [
          {
            pod: pod1,
            delegateIfMatching: {
              type: "object",
              required: ["value"],
              properties: {
                value: {
                  type: "object",
                  required: ["podAnnounce"],
                  properties: {
                    podAnnounce: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
          {
            pod: `https://${randomString()}.com`,
          },
          {
            pod: pod3,
            delegateIfMatching: {
              type: "object",
              required: ["somethingDifferent"],
            },
          },
          {
            pod: pod2,
            delegateIfMatching: {
              type: "object",
            },
          },
        ],
      },
    },
    channels: [],
  } satisfies GraffitiLocalObject<typeof USER_SETTINGS_SCHEMA>;

  const manager = new PodDelegation(new Ajv());
  const announceTos = manager.announceToPods(
    "https://somepod.com",
    [],
    settings,
  );
  expect(announceTos.sort()).toEqual([pod1, pod2].sort());
});
