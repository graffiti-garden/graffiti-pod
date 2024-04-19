import { Test, TestingModule } from "@nestjs/testing";
import { StoreService } from "./store.service";
import { RootMongooseModule } from "../app.module";
import { GraffitiObjectMongooseModule } from "../schemas/object.schema";
import { randomString, randomGraffitiObject } from "../test/utils";
import { Error as MongooseError } from "mongoose";
import { HttpException } from "@nestjs/common";

describe("StoreService", () => {
  let service: StoreService;

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

      expect.assertions(2);
      try {
        await service.putObject(go);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.status).toBe(422);
      }
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

  it("put, delete, get", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);
    const deleted = await service.deleteObject(go.webId, go.name);
    expect(deleted.value).toStrictEqual(go.value);
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result).toBeNull();
  });

  it("delete non existant object", async () => {
    const deleted = await service.deleteObject(randomString(), randomString());
    expect(deleted).toBeNull();
  });

  it("patch simple", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);
    const patched = await service.patchObject(go.webId, go.name, [
      { op: "replace", path: `/${Object.keys(go.value)[0]}`, value: 42 },
      { op: "replace", path: `/newthing`, value: "new" },
    ]);
    expect(patched.value).toStrictEqual({
      [Object.keys(go.value)[0]]: 42,
      newthing: "new",
    });

    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result.value).toStrictEqual(patched.value);
  });

  it("patch 'increment' with test", async () => {
    const go = randomGraffitiObject();
    go.value = { counter: 1 };
    await service.putObject(go);

    const patched = await service.patchObject(go.webId, go.name, [
      { op: "test", path: "/counter", value: 1 },
      { op: "replace", path: "/counter", value: 2 },
    ]);
    expect(patched.value).toHaveProperty("counter", 2);
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result.value).toStrictEqual(patched.value);

    try {
      await service.patchObject(go.webId, go.name, [
        { op: "test", path: "/counter", value: 1 },
        { op: "replace", path: "/counter", value: 2 },
      ]);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(412);
    }

    expect.assertions(4);
  });

  it("patch nonexistant object", async () => {
    const patched = await service.patchObject(randomString(), randomString(), [
      { op: "replace", path: "/test", value: 0 },
    ]);

    expect(patched).toBeNull();
  });

  it("concurrent patches", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);

    // Patch at the same time
    const jobs = [];
    for (let i = 0; i < 1000; i++) {
      jobs.push(
        service.patchObject(go.webId, go.name, [
          { op: "replace", path: "/something", value: 0 },
        ]),
      );
    }

    const results = await Promise.allSettled(jobs);
    let numErrors = 0;
    for (const result of results) {
      if (result.status === "rejected") {
        numErrors++;
        expect(result.reason).toBeInstanceOf(HttpException);
        expect(result.reason.status).toBe(409);
      }
    }
    expect(numErrors).toBeGreaterThan(0);
  });
});
