import { it, expect } from "vitest";
import { randomLocation, randomString } from "./test-utils";
import { toUrl, fromUrl, parseLocationOrUrl } from "./types";

it("url and location", async () => {
  const location = randomLocation(randomString(), randomString());
  const url = toUrl(location);
  const location2 = fromUrl(url);
  expect(location).toEqual(location2);
});

it("parse url", async () => {
  const url = "https://example.com/somewebid/someobject";
  const location = fromUrl(url);
  expect(location.pod).toBe("https://example.com");
  expect(location.webId).toBe("somewebid");
  expect(location.name).toBe("someobject");
});

it("parse url encoded", async () => {
  const webId = "?//+? 👻";
  const name = "+//-🪿 `~423";
  const url = `https://example.com/${encodeURIComponent(webId)}/${encodeURIComponent(name)}`;
  const location = fromUrl(url);
  expect(location.pod).toBe("https://example.com");
  expect(location.webId).toBe(webId);
  expect(location.name).toBe(name);
});

it("location or url is location", async () => {
  const location = randomLocation(randomString(), randomString());
  const parsed = parseLocationOrUrl(location);
  expect(parsed.location).toEqual(location);
  expect(parsed.url).toBe(toUrl(location));
});

it("location or url is url", async () => {
  const url = "https://example.com/somewebid/someobject";
  const parsed = parseLocationOrUrl(url);
  expect(parsed.url).toBe(url);
  expect(parsed.location.pod).toBe("https://example.com");
  expect(parsed.location.webId).toBe("somewebid");
  expect(parsed.location.name).toBe("someobject");
});
