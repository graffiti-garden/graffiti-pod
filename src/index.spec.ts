import { it, expect } from "vitest";
import * as secrets from "../.secrets.json";
import { Session } from "@inrupt/solid-client-authn-node";
import GraffitiClient, { GraffitiPatch } from ".";
import { randomBytes } from "@noble/hashes/utils";
import { base64Encode } from "./info-hash";

const session = new Session({ keepAlive: true });
await session.login(secrets);
if (!session.info.isLoggedIn || !session.info.webId) {
  throw new Error("Could not log in");
}
const fetch = session.fetch;
const webId = session.info.webId;

function randomString() {
  return base64Encode(randomBytes(16));
}

function randomValue() {
  return {
    [randomString()]: randomString(),
  };
}

// const homePod = "http://localhost:3000";
const homePod = "https://pod.graffiti.garden";
function randomLocation() {
  return {
    name: randomString(),
    webId,
    graffitiPod: homePod,
  };
}

it("url and location", async () => {
  const location = randomLocation();
  const url = GraffitiClient.toUrl(location);
  const location2 = GraffitiClient.fromUrl(url);
  expect(location).toEqual(location2);
});

it("Put, replace, delete", async () => {
  const value = {
    something: "hello, world~ c:",
  };
  const location = randomLocation();
  const graffiti = new GraffitiClient();
  const previous = await graffiti.put({ value, channels: [] }, location, {
    fetch,
  });
  expect(previous.value).toBeNull();
  expect(previous.name).toEqual(location.name);
  expect(previous.webId).toEqual(location.webId);
  expect(previous.graffitiPod).toEqual(location.graffitiPod);
  const gotten = await graffiti.get(location);
  expect(gotten.value).toEqual(value);
  expect(gotten.channels).toEqual([]);
  expect(gotten.acl).toBeUndefined();
  expect(gotten.name).toEqual(location.name);
  expect(gotten.webId).toEqual(location.webId);
  expect(gotten.graffitiPod).toEqual(location.graffitiPod);

  // Replace it and get again
  const newValue = {
    something: "goodbye, world~ c:",
  };
  const beforeReplaced = await graffiti.put(
    { value: newValue, channels: [] },
    location,
    {
      fetch,
    },
  );
  expect(beforeReplaced).toEqual(gotten);
  const afterReplaced = await graffiti.get(location);
  expect(afterReplaced.value).toEqual(newValue);

  // Finally, delete
  const beforeDeleted = await graffiti.delete(location, { fetch });
  expect(beforeDeleted).toEqual(afterReplaced);
  await expect(graffiti.get(location)).rejects.toThrow();
});

it("put and get with access control", async () => {
  const graffiti = new GraffitiClient();
  const location = randomLocation();
  const value = {
    um: "hi",
  };
  await graffiti.put(
    {
      value,
      acl: [],
      channels: ["helloooo"],
    },
    location,
    { fetch },
  );

  // Get it with authenticated fetch
  const gotten = await graffiti.get(location, { fetch });
  expect(gotten.value).toEqual(value);

  // But not with plain fetch
  await expect(graffiti.get(location)).rejects.toThrow();
});

it("patch value", async () => {
  const graffiti = new GraffitiClient();
  const location = randomLocation();
  const value = {
    something: "hello, world~ c:",
  };
  await graffiti.put({ value, channels: [] }, location, { fetch });

  const patch: GraffitiPatch = {
    value: [{ op: "replace", path: "/something", value: "goodbye, world~ c:" }],
  };
  await graffiti.patch(patch, location, { fetch });
  const gotten = await graffiti.get(location);
  expect(gotten.value).toEqual({
    something: "goodbye, world~ c:",
  });
  await graffiti.delete(location, { fetch });
});

it("patch channels", async () => {
  const graffiti = new GraffitiClient();
  const location = randomLocation();
  await graffiti.put({ value: {}, channels: ["helloooo"] }, location, {
    fetch,
  });

  const patch: GraffitiPatch = {
    channels: [{ op: "replace", path: "/0", value: "goodbye" }],
  };
  await graffiti.patch(patch, location, { fetch });
  const gotten = await graffiti.get(location, { fetch });
  expect(gotten.channels).toEqual(["goodbye"]);
  await graffiti.delete(location, { fetch });
});

it("query single", async () => {
  const graffiti = new GraffitiClient();
  const location = randomLocation();
  const value = randomValue();
  const channels = [randomString(), randomString()];

  await graffiti.put({ value, channels }, location, { fetch });

  const iterator = graffiti.query(channels, homePod, { fetch });
  const result = await iterator.next();
  expect(result.done).toBe(false);
  expect(result.value?.value).toEqual(value);
  const result2 = await iterator.next();
  expect(result2.done).toBe(true);
});

it("query multiple", async () => {
  const graffiti = new GraffitiClient();
  const channels = [randomString(), randomString()];
  const values = [randomValue(), randomValue()];
  await graffiti.put({ value: values[0], channels }, randomLocation(), {
    fetch,
  });
  await graffiti.put({ value: values[1], channels }, randomLocation(), {
    fetch,
  });
  const iterator = graffiti.query(channels, homePod, { fetch });
  const result1 = await iterator.next();
  expect(result1.value?.value).toEqual(values[0]);
  const result2 = await iterator.next();
  expect(result2.value?.value).toEqual(values[1]);
  const result3 = await iterator.next();
  expect(result3.done).toBe(true);
});

it("invalid query", async () => {
  const graffiti = new GraffitiClient();
  const iterator = graffiti.query([], homePod, {
    fetch,
    query: {
      asdf: {},
    },
  });
  await expect(iterator.next()).rejects.toThrow();
});

it("query with actual query", async () => {
  const graffiti = new GraffitiClient();
  const channels = [randomString(), randomString()];
  const values = [randomValue(), randomValue()];
  for (const value of values) {
    await graffiti.put({ value, channels }, randomLocation(), { fetch });
  }
  // Query for the first value
  const iterator = graffiti.query(channels, homePod, {
    fetch,
    query: {
      properties: {
        value: {
          required: Object.keys(values[0]),
        },
      },
    },
  });
  const result1 = await iterator.next();
  expect(result1.value?.value).toEqual(values[0]);
  const result2 = await iterator.next();
  expect(result2.done).toBe(true);
});

it("query with last modified", async () => {
  const graffiti = new GraffitiClient();
  const location = randomLocation();
  const channels = [randomString(), randomString()];
  await graffiti.put({ value: randomValue(), channels }, location, { fetch });
  const lastModified = (await graffiti.get(location)).lastModified;

  const value = randomValue();
  const location2 = randomLocation();
  await graffiti.put({ value, channels }, location2, { fetch });
  const lastModified2 = (await graffiti.get(location2)).lastModified;
  expect(lastModified.getTime()).toBeLessThan(lastModified2.getTime());

  const iterator = graffiti.query(channels, homePod, {
    fetch,
    ifModifiedSince: new Date(lastModified.getTime() + 1),
  });
  const result1 = await iterator.next();
  expect(result1.value?.value).toEqual(value);
  const result2 = await iterator.next();
  expect(result2.done).toBe(true);
});

// TODO:
// make channels have a more reasonable return
// (server side or client...)
// should you even be able to specify queries for channels?
