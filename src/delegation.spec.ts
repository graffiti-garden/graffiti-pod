import { it, expect } from "vitest";
import Delegation from "./delegation";
import { solidLogin } from "./test-utils";

const { fetch, webId } = await solidLogin();

it("Add and remove pods", async () => {
  const podName = `https://${Math.random().toString(36).substring(7)}.com`;
  const manager = new Delegation();

  let pods = await manager.getPods(webId);
  expect(pods).not.toContain(podName);

  await manager.addPod(webId, podName, { fetch });
  pods = await manager.getPods(webId);
  expect(pods).toContain(podName);

  await manager.removePod(webId, podName, { fetch });
  pods = await manager.getPods(webId);
  expect(pods).not.toContain(podName);
}, 100000);
