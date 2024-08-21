import {
  encodeURIArray,
  decodeURIArray,
  rangeToSkipLimit,
  parseDateString,
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

it("no skip/limit", () => {
  const { skip, limit } = rangeToSkipLimit("");
  expect(skip).toBeUndefined();
  expect(limit).toBeUndefined();
});

it("basic skip/limit", () => {
  const { skip, limit } = rangeToSkipLimit("posts=0-499");
  expect(skip).toBe(0);
  expect(limit).toBe(500);
});

it("skip, unbounded limit", () => {
  const { skip, limit } = rangeToSkipLimit("posts=900-");
  expect(skip).toBe(900);
  expect(limit).toBeUndefined();
});

it("no =", () => {
  const { skip, limit } = rangeToSkipLimit("posts");
  expect(skip).toBeUndefined();
  expect(limit).toBeUndefined();
});

it("no -", () => {
  const { skip, limit } = rangeToSkipLimit("posts=900");
  expect(skip).toBe(900);
  expect(limit).toBeUndefined();
});

it("no start", () => {
  const { skip, limit } = rangeToSkipLimit("posts=-499");
  expect(skip).toBeUndefined();
  expect(limit).toBe(500);
});

it("multiple range", () => {
  const { skip, limit } = rangeToSkipLimit("posts=asdf-qwer");
  expect(skip).toBeUndefined();
  expect(limit).toBeUndefined();
});

it("multiple ---", () => {
  const { skip, limit } = rangeToSkipLimit("posts=-10-30-");
  expect(skip).toBeUndefined();
  expect(limit).toBe(11);
});

it("bad skip of limit", () => {
  const { skip, limit } = rangeToSkipLimit("posts=asdf-30");
  expect(skip).toBeUndefined();
  expect(limit).toBe(31);
});

it("good date", () => {
  const date = parseDateString("2021-01-01");
  expect(date).toStrictEqual(new Date("2021-01-01"));
});

it("bad date", () => {
  expect(() => parseDateString("asdf")).toThrow();
});

it("undefined date", () => {
  const date = parseDateString(undefined);
  expect(date).toBeUndefined();
});
