import { describe, it, expect } from "vitest";
import * as secrets from "../.secrets.json";
import { Session } from "@inrupt/solid-client-authn-node";
import WebIdManager from "./webid-manager";

const session = new Session({ keepAlive: true });
await session.login(secrets);
if (!session.info.isLoggedIn || !session.info.webId) {
  throw new Error("Could not log in");
}
const fetch = session.fetch;
const webId = session.info.webId;

it("Add and remove pods", async () => {
  const podName = `https://${Math.random().toString(36).substring(7)}.com`;
  const manager = new WebIdManager();

  let pods = await manager.getGraffitiPods(webId);
  expect(pods).not.toContain(podName);

  await manager.addGraffitiPod(webId, podName, { fetch });
  pods = await manager.getGraffitiPods(webId);
  expect(pods).toContain(podName);

  await manager.removeGraffitiPod(webId, podName, { fetch });
  pods = await manager.getGraffitiPods(webId);
  expect(pods).not.toContain(podName);
}, 100000);
