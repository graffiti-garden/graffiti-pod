import { it, expect } from "vitest";
import LocalChanges from "./local-changes";
import { randomGraffitiObject, randomString, randomValue } from "./test-utils";
import type { GraffitiLocalObject, GraffitiObject } from "./types";

it("match overlapping channels", () => {
  const localChanges = new LocalChanges();
  const object: GraffitiObject = randomGraffitiObject();

  expect(
    localChanges.matchObject(object, {
      channels: object.channels,
    }),
  ).toBe(true);
  expect(
    localChanges.matchObject(object, {
      channels: [object.channels[0]],
    }),
  ).toBe(true);
  expect(
    localChanges.matchObject(object, {
      channels: [randomString(), object.channels[1], randomString()],
    }),
  ).toBe(true);
  expect(
    localChanges.matchObject(object, {
      channels: [randomString(), randomString()],
    }),
  ).toBe(false);
  expect(
    localChanges.matchObject(object, {
      channels: [],
    }),
  ).toBe(false);
});

it("match ifModifiedSince", () => {
  const localChanges = new LocalChanges();
  const object: GraffitiObject = randomGraffitiObject();

  expect(
    localChanges.matchObject(object, {
      channels: object.channels,
      ifModifiedSince: object.lastModified,
    }),
  ).toBe(true);
  expect(
    localChanges.matchObject(object, {
      channels: object.channels,
      ifModifiedSince: new Date(object.lastModified.getTime() - 1),
    }),
  ).toBe(true);
  expect(
    localChanges.matchObject(object, {
      channels: object.channels,
      ifModifiedSince: new Date(object.lastModified.getTime() + 1),
    }),
  ).toBe(false);
});

it("put", async () => {
  const localChanges = new LocalChanges();
  const beforeChannel = randomString();
  const before = localChanges.discover([beforeChannel], {}).next();
  const afterChannel = randomString();
  const after = localChanges.discover([afterChannel], {}).next();
  const sharedChannel = randomString();
  const shared = localChanges.discover([sharedChannel], {}).next();

  const oldObject: GraffitiObject = randomGraffitiObject();
  oldObject.channels = [beforeChannel, sharedChannel];
  oldObject.tombstone = true;

  const newLocalObject: GraffitiLocalObject = {
    value: randomValue(),
    channels: [afterChannel, sharedChannel],
  };

  localChanges.put(newLocalObject, oldObject);

  const newObject: GraffitiObject = {
    ...oldObject,
    ...newLocalObject,
    tombstone: false,
  };

  expect((await before).value).toEqual(oldObject);
  expect((await after).value).toEqual(newObject);
  expect((await shared).value).toEqual(newObject);
});

it("patch", async () => {
  const localChanges = new LocalChanges();
  const beforeChannel = randomString();
  const before = localChanges.discover([beforeChannel], {}).next();
  const afterChannel = randomString();
  const after = localChanges.discover([afterChannel], {}).next();
  const sharedChannel = randomString();
  const shared = localChanges.discover([sharedChannel], {}).next();

  const oldObject: GraffitiObject = randomGraffitiObject();
  oldObject.channels = [beforeChannel, sharedChannel];
  oldObject.tombstone = true;

  localChanges.patch(
    {
      value: [
        {
          op: "add",
          path: "/something",
          value: "new value",
        },
      ],
      channels: [
        {
          op: "add",
          path: "/-",
          value: afterChannel,
        },
        {
          op: "remove",
          path: `/${oldObject.channels.indexOf(beforeChannel)}`,
        },
      ],
    },
    oldObject,
  );

  expect((await before).value).toEqual(oldObject);
  const newObject = {
    ...oldObject,
    channels: [sharedChannel, afterChannel],
    value: {
      ...oldObject.value,
      something: "new value",
    },
    tombstone: false,
  };
  expect((await after).value).toEqual(newObject);
  expect((await shared).value).toEqual(newObject);
});

it("delete", async () => {
  const localChanges = new LocalChanges();
  const channels = [randomString(), randomString(), randomString()];
  const result = localChanges.discover(channels, {}).next();

  const oldObject: GraffitiObject = randomGraffitiObject();
  oldObject.channels = [randomString(), ...channels.slice(1)];
  oldObject.tombstone = true;

  localChanges.delete(oldObject);

  expect((await result).value).toEqual(oldObject);
});

it("JSON query", async () => {
  const localChanges = new LocalChanges();
  const channels = [randomString(), randomString(), randomString()];
  const resultNoQuery = localChanges.discover(channels, {}).next();
  const resultQuery = localChanges
    .discover(channels, {
      properties: {
        value: {
          properties: {
            something: {
              type: "object",
            },
          },
          required: ["something"],
        },
      },
    })
    .next();
  const resultBadQuery = localChanges
    .discover(channels, {
      not: {
        properties: {
          value: {
            required: ["something"],
          },
        },
      },
    })
    .next();

  const oldObject: GraffitiObject = randomGraffitiObject();
  oldObject.channels = [randomString(), ...channels.slice(1)];
  oldObject.tombstone = true;

  const newObject: GraffitiObject = {
    ...oldObject,
    tombstone: false,
    value: {
      ...oldObject.value,
      something: randomValue(),
    },
  };

  localChanges.put(newObject, oldObject);

  const noQueryResult = await resultNoQuery;
  expect(noQueryResult.value).toEqual(newObject);
  // This should be a type error
  // noQueryResult.value?.value.something;
  const result = await resultQuery;
  expect(result.value?.value.something).toBeDefined();
  expect(result.value).toEqual(newObject);
  // No type error here!
  expect(result.value?.value.something).toBeDefined();
  expect((await resultBadQuery).value).toEqual(oldObject);
});
