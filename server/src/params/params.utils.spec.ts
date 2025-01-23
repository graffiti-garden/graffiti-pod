import { it, expect } from "vitest";
import {
  encodeURIArray,
  decodeURIArray,
  parseQueryParamFromPath,
} from "./params.utils";

it("encode and decode empty array", () => {
  const encoded = encodeURIArray([]);
  const decoded = decodeURIArray(encoded);
  expect(decoded).toStrictEqual([]);
});

it("encode and decode URI arrays", () => {
  const headers = ["asdf", "🎨dk,fj", "👀,/laskdk,kdjf"];
  const encoded = encodeURIArray(headers);
  const decoded = decodeURIArray(encoded);
  expect(decoded).toStrictEqual(headers);
});

it("parse query param from path", () => {
  const path = "/posts?red=123&blue=456&&black=&green=789";
  expect(parseQueryParamFromPath("red", path)).toBe("123");
  expect(parseQueryParamFromPath("blue", path)).toBe("456");
  expect(parseQueryParamFromPath("black", path)).toBe("");
  expect(parseQueryParamFromPath("green", path)).toBe("789");
  expect(parseQueryParamFromPath("yellow", path)).toBeUndefined();
});
