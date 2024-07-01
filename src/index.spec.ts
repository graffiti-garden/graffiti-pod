import { it, expect } from "vitest";
import * as secrets from "../.secrets.json";
import { Session } from "@inrupt/solid-client-authn-node";
import GraffitiClient, { GraffitiPatch } from ".";

const session = new Session({ keepAlive: true });
await session.login(secrets);
if (!session.info.isLoggedIn || !session.info.webId) {
  throw new Error("Could not log in");
}
const fetch = session.fetch;
const webId = session.info.webId;

function randomLocation() {
  return {
    name: Math.random().toString(36).substring(7),
    webId,
    graffitiPod: "https://pod.graffiti.garden",
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
  const previous = await graffiti.put({ value }, location, { fetch });
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
  const beforeReplaced = await graffiti.put({ value: newValue }, location, {
    fetch,
  });
  expect(beforeReplaced).toEqual(gotten);
  const afterReplaced = await graffiti.get(location);
  expect(afterReplaced.value).toEqual(newValue);

  // Finally, delete
  const beforeDeleted = await graffiti.delete(location, { fetch });
  expect(beforeDeleted).toEqual(afterReplaced);
  await expect(graffiti.get(location)).rejects.toThrow(
    JSON.stringify({
      message:
        "Cannot GET object - either it does not exist or you do not have access to it.",
      error: "Not Found",
      statusCode: 404,
    }),
  );
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
  await expect(graffiti.get(location)).rejects.toThrow(
    JSON.stringify({
      message:
        "Cannot GET object - either it does not exist or you do not have access to it.",
      error: "Not Found",
      statusCode: 404,
    }),
  );
});

it("patch value", async () => {
  const graffiti = new GraffitiClient();
  const location = randomLocation();
  const value = {
    something: "hello, world~ c:",
  };
  await graffiti.put({ value }, location, { fetch });

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
