import { encodeHeaderArray, decodeHeaderArray } from "./params.utils";

it("encode and decode header arrays", () => {
  const headers = ["asdf", "🎨dk,fj", "👀,/laskdk,kdjf"];
  const encoded = encodeHeaderArray(headers);
  const decoded = decodeHeaderArray(encoded);
  expect(decoded).toStrictEqual(headers);
});
