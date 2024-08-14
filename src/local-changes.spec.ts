import { it, expect } from "vitest";
import LocalChanges from "./local-changes";
import { randomGraffitiObject, randomString, randomValue } from "./test-utils";
import { GraffitiLocalObject, GraffitiObject } from "./types";

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

it("match validation function", () => {
  const localChanges = new LocalChanges();
  const object: GraffitiObject = randomGraffitiObject();

  expect(
    localChanges.matchObject(object, {
      channels: object.channels,
      validate: () => true,
    }),
  ).toBe(true);
  expect(
    localChanges.matchObject(object, {
      channels: object.channels,
      validate: () => false,
    }),
  ).toBe(false);
});

it("put", async () => {
  const localChanges = new LocalChanges();
  const beforeChannel = randomString();
  const before = localChanges.query([beforeChannel]).next();
  const afterChannel = randomString();
  const after = localChanges.query([afterChannel]).next();
  const sharedChannel = randomString();
  const shared = localChanges.query([sharedChannel]).next();

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
  const before = localChanges.query([beforeChannel]).next();
  const afterChannel = randomString();
  const after = localChanges.query([afterChannel]).next();
  const sharedChannel = randomString();
  const shared = localChanges.query([sharedChannel]).next();

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
  const result = localChanges.query(channels).next();

  const oldObject: GraffitiObject = randomGraffitiObject();
  oldObject.channels = [randomString(), ...channels.slice(1)];
  oldObject.tombstone = true;

  localChanges.delete(oldObject);

  expect((await result).value).toEqual(oldObject);
});

it("JSON query", async () => {
  const localChanges = new LocalChanges();
  const channels = [randomString(), randomString(), randomString()];
  const resultNoQuery = localChanges.query(channels).next();
  const resultQuery = localChanges
    .query(channels, {
      query: {
        not: {
          properties: {
            value: {
              required: ["something"],
            },
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

  expect((await resultNoQuery).value).toEqual(newObject);
  expect((await resultQuery).value).toEqual(oldObject);
});
