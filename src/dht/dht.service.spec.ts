import { Test, TestingModule } from "@nestjs/testing";
import { DhtService } from "./dht.service";

describe("DhtService", () => {
  let service: DhtService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DhtService],
    }).compile();
    service = module.get<DhtService>(DhtService);
  });

  it("hash", () => {
    const infoHash = service.channelToInfoHash("test");
    console.log(infoHash);
  });

  it("announce", async () => {
    await service.announce("test");
  }, 100000);
});
