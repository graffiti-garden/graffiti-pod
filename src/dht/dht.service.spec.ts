import { Test, TestingModule } from "@nestjs/testing";
import { DhtService } from "./dht.service";
import { randomString } from "../test/utils";

describe("DhtService", () => {
  let service: DhtService;
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DhtService],
    }).compile();
    service = module.get<DhtService>(DhtService);
  });
  afterEach(async () => {
    await service.close();
  });

  it("hash", () => {
    const infoHash = service.channelToInfoHash("test");
    expect(infoHash).toHaveLength(40);
  });

  it("lookup random peer", async () => {
    const channel = randomString();
    await service.announce(channel);
    const peers = await service.lookup(channel);
    expect(peers).toHaveLength(1);
  }, 100000);
});
