import { it, expect } from "vitest";
import * as secrets from "../.secrets.json";
import { Session } from "@inrupt/solid-client-authn-node";
import GraffitiClient from ".";

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
