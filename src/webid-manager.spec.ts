import { it, expect } from "vitest";
import WebIdManager from "./webid-manager";
import { solidLogin } from "./test-utils";

const { fetch, webId } = await solidLogin();

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
