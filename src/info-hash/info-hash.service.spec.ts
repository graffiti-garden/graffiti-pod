import { Test, TestingModule } from "@nestjs/testing";
import { InfoHashService } from "./info-hash.service";
import { randomString } from "../test/utils";

describe("InfoHashService", () => {
  let service: InfoHashService;
  let channel: string;
  let challenge: string;
  let infoHash: string;
  let pok: string;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InfoHashService],
    }).compile();

    service = module.get<InfoHashService>(InfoHashService);

    channel = randomString();
    challenge = randomString();
    infoHash = service.toInfoHash(channel);
    pok = service.toPok(channel, challenge);
  });

  it("correct verification", () => {
    expect(service.verifyInfoHashAndPok(infoHash, pok, challenge)).toBe(true);
  });

  it("wrong challenge", () => {
    expect(service.verifyInfoHashAndPok(infoHash, pok, randomString())).toBe(
      false,
    );
  });

  it("wrong infoHash", () => {
    expect(service.verifyInfoHashAndPok(randomString(32), pok, challenge)).toBe(
      false,
    );
  });

  it("wrong pok", () => {
    expect(
      service.verifyInfoHashAndPok(infoHash, randomString(64), challenge),
    ).toBe(false);
  });
});
