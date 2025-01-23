import { it, expect } from "vitest";
import SettingsUrlManager from "./settings-url";
import { randomString, solidLogin } from "./test-utils";

const { fetch, webId } = await solidLogin();

it("get, set, delete settings URL", async () => {
  const manager = new SettingsUrlManager();

  const existingUrl = await manager.getSettingsUrl(webId, { fetch });

  const newUrl = `https://${randomString()}.com`;
  await manager.setSettingsUrl(webId, newUrl, { fetch });

  const gottenUrl = await manager.getSettingsUrl(webId, { fetch });
  expect(gottenUrl).toBe(newUrl);

  await manager.deleteSettingsUrl(webId, { fetch });
  const gottenUrl2 = await manager.getSettingsUrl(webId, { fetch });
  expect(gottenUrl2).toBe(null);

  // Restore the existing URL
  if (existingUrl) {
    await manager.setSettingsUrl(webId, existingUrl, { fetch });
    const gottenUrl3 = await manager.getSettingsUrl(webId, { fetch });
    expect(gottenUrl3).toBe(existingUrl);
  }
}, 100000);
