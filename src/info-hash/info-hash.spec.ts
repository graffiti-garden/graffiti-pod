import { InfoHash, base64Decode, base64Encode } from "./info-hash";
import { randomString } from "../test/utils";
import { randomBytes } from "@noble/hashes/utils";

it("base64 encode decode", () => {
  for (const numBytes of [1, 7, 8, 9, 20, 32, 64]) {
    const bytes = randomBytes(numBytes);
    const encoded = base64Encode(bytes);
    const decoded = base64Decode(encoded);
    expect(decoded).toStrictEqual(bytes);
  }
});

describe("InfoHash", () => {
  let channel: string;
  let infoHash: string;
  let pok: string;

  beforeEach(async () => {
    channel = randomString();
    infoHash = InfoHash.toInfoHash(channel);
    pok = InfoHash.toPok(channel);
  });

  it("correct verification", () => {
    expect(InfoHash.verifyInfoHashAndPok(infoHash, pok)).toBe(true);
  });

  it("wrong infoHash", () => {
    expect(InfoHash.verifyInfoHashAndPok(randomString(32), pok)).toBe(false);
  });

  it("wrong pok", () => {
    expect(InfoHash.verifyInfoHashAndPok(infoHash, randomString(64))).toBe(
      false,
    );
  });

  it("invalid pok", () => {
    expect(InfoHash.verifyInfoHashAndPok(infoHash, "")).toBe(false);
  });

  it("obscured channel", () => {
    const obscured = InfoHash.obscureChannel(channel);
    expect(InfoHash.verifyObscuredChannel(obscured)).toBe(infoHash);
  });

  it("bad obscured channel", () => {
    expect(() => InfoHash.verifyObscuredChannel("asdlkfj.kdfjkdj")).toThrow();
  });
});
