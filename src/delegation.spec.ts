import { it, expect } from "vitest";
import Delegation from "./delegation";
import { randomString, solidLogin } from "./test-utils";

const { fetch, webId } = await solidLogin();

it("Add and remove pods", async () => {
  const podName = `https://${randomString()}.com`;
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

it("Pods with paths", async () => {
  const basePod = `http://${randomString()}.com:8080`;
  const delegator = new Delegation();

  const existingPods = await delegator.getPods(webId);
  expect(existingPods).not.toContain(basePod);

  await delegator.addPod(webId, basePod, { fetch });
  await delegator.addPod(webId, basePod + "//", { fetch });
  await delegator.addPod(webId, basePod + "/lsdjfkd/kdjfkdj", { fetch });

  const newPods = await delegator.getPods(webId);
  expect(newPods.length).toBe(existingPods.length + 1);
  expect(newPods).toContain(basePod);

  await delegator.removePod(webId, basePod, { fetch });
  const finalPods = await delegator.getPods(webId);
  expect(finalPods.sort()).toEqual(existingPods.sort());
});
