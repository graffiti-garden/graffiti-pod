import {
  encodeHeaderArray,
  decodeHeaderArray,
  rangeToSkipLimit,
} from "./params.utils";

it("encode and decode empty array", () => {
  const encoded = encodeHeaderArray([]);
  const decoded = decodeHeaderArray(encoded);
  expect(decoded).toStrictEqual([]);
});

it("encode and decode header arrays", () => {
  const headers = ["asdf", "🎨dk,fj", "👀,/laskdk,kdjf"];
  const encoded = encodeHeaderArray(headers);
  const decoded = decodeHeaderArray(encoded);
  expect(decoded).toStrictEqual(headers);
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
