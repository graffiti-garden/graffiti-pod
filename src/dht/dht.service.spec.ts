import { Test, TestingModule } from "@nestjs/testing";
import { DhtService } from "./dht.service";
import { randomString } from "../test/utils";

describe("DhtService", () => {
  jest.setTimeout(100000);

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

  it("no unannouncing non-announced channel", async () => {
    await expect(service.unannounce(randomString())).rejects.toThrow();
  });

  it("lookup nonexistant peer", async () => {
    const peers = await service.lookup(randomString());
    expect(peers).toHaveLength(0);
  });

  it("lookup random peer", async () => {
    const channel = randomString();
    await service.announce(channel);
    const peers = await service.lookup(channel);
    expect(peers).toHaveLength(1);
  });

  it("no multiple announces", async () => {
    const channel = randomString();
    await service.announce(channel);
    await expect(service.announce(channel)).rejects.toThrow();
    await service.unannounce(channel);
    await service.announce(channel);
  });
});
