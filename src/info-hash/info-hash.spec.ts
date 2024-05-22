import { InfoHash } from "./info-hash";
import { randomString } from "../test/utils";

describe("InfoHashService", () => {
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
});
