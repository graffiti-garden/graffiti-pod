import { Test, TestingModule } from "@nestjs/testing";
import { StoreService } from "./store.service";
import { GraffitiObject } from "../schemas/object.schema";
import { RootMongooseModule } from "../app.module";
import { GraffitiObjectMongooseModule } from "../schemas/object.schema";

describe("StoreService", () => {
  let service: StoreService;

  function randomString() {
    return Math.random().toString(36).substring(7);
  }

  function randomGraffitiObject() {
    const go = new GraffitiObject();
    go.webId = randomString();
    go.name = randomString();
    go.value = { [randomString()]: randomString() };
    go.channels = [];
    return go;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, GraffitiObjectMongooseModule],
      providers: [StoreService],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  for (const modification of [
    (go) => delete go.webId,
    (go) => delete go.name,
    (go) => delete go.value,
    (go) => delete go.channels,
    (go) => (go.webId = null),
    (go) => (go.value = 42),
    (go) => (go.value = null),
    (go) => (go.value = []),
    (go) => (go.channels = undefined),
    (go) => (go.channels = null),
    (go) => (go.channels = [undefined]),
    (go) => (go.channels = [null]),
  ]) {
    it("put invalid data", async () => {
      const go = randomGraffitiObject();
      modification(go);
      await expect(service.putObject(go)).rejects.toThrow();
    });
  }

  it("get non existant object", async () => {
    const result = await service.getObject(
      randomString(),
      randomString(),
      randomString(),
    );
    expect(result).toBeNull();
  });

  it("put and get same owner, public", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result.webId).toBe(go.webId);
    expect(result.name).toBe(go.name);
    expect(result.value).toStrictEqual(go.value);
  });

  it("put and get same owner, private", async () => {
    const go = randomGraffitiObject();
    go.acl = [];
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result.webId).toBe(go.webId);
    expect(result.name).toBe(go.name);
    expect(result.value).toStrictEqual(go.value);
  });

  it("put and get public", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, randomString());
    expect(result.webId).toBe(go.webId);
    expect(result.name).toBe(go.name);
    expect(result.value).toStrictEqual(go.value);
  });

  it("put and get private, allowed", async () => {
    const go = randomGraffitiObject();
    const webId = randomString();
    go.acl = [webId];
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, webId);
    expect(result.webId).toBe(go.webId);
    expect(result.name).toBe(go.name);
    expect(result.value).toStrictEqual(go.value);
  });

  it("put and get private, not allowed", async () => {
    const go = randomGraffitiObject();
    const webId = randomString();
    go.acl = [];
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, webId);
    expect(result).toBeNull();
  });
});
