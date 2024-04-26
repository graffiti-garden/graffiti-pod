import { Test, TestingModule } from "@nestjs/testing";
import { StoreService } from "./store.service";
import { RootMongooseModule } from "../app.module";
import { StoreMongooseModule } from "./store.schema";
import {
  randomString,
  randomGraffitiObject,
  responseMock,
} from "../test/utils";
import { HttpException } from "@nestjs/common";
import { Operation } from "fast-json-patch";
import { InfoHashService } from "../info-hash/info-hash.service";
import { StoreSchema } from "./store.schema";
import { encodeHeaderArray } from "../params/params.utils";

describe("StoreService", () => {
  let service: StoreService;
  let infoHashService: InfoHashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, StoreMongooseModule],
      providers: [StoreService, InfoHashService],
    }).compile();

    service = module.get<StoreService>(StoreService);
    infoHashService = module.get<InfoHashService>(InfoHashService);
  });

  it("unauthorized", async () => {
    try {
      service.validateWebId(randomString(), null);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(401);
    }
    expect.assertions(2);
  });

  it("forbidden", async () => {
    try {
      service.validateWebId(randomString(), randomString());
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(403);
    }
    expect.assertions(2);
  });

  it("authorized", async () => {
    const webId = randomString();
    expect(service.validateWebId(webId, webId)).toBeUndefined();
  });

  it("return same owner", async () => {
    const go = randomGraffitiObject();
    go.channels = [randomString(), randomString()];
    go.acl = [randomString(), randomString()];
    const response = responseMock();
    const returned = service.returnObject(go, go.webId, response);
    expect(returned).toStrictEqual(go.value);
    expect(response.getHeader("Channels")).toBe(encodeHeaderArray(go.channels));
    expect(response.getHeader("Access-Control-List")).toBe(
      encodeHeaderArray(go.acl),
    );
  });

  it("return different owner", async () => {
    const go = randomGraffitiObject();
    go.channels = [randomString(), randomString()];
    go.acl = [randomString(), randomString()];
    const response = responseMock();
    const returned = service.returnObject(go, randomString(), response);
    expect(returned).toStrictEqual(go.value);
    expect(response.getHeader("Channels")).toBeUndefined();
    expect(response.getHeader("Access-Control-List")).toBeUndefined();
  });

  it("return null", async () => {
    try {
      service.returnObject(null, randomString(), responseMock());
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(404);
    }
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

  it("put valid data", async () => {
    const go = randomGraffitiObject();
    go.channels = [randomString(), randomString(), "🪿🕰️"];
    await service.putObject(go);
  });

  it("good info hashes", async () => {
    const go = randomGraffitiObject();
    go.channels = [randomString()];
    go.infoHashes = [randomString(32)];
    await service.putObject(go);
  });

  for (const infoHashes of [
    [],
    [randomString(), randomString()],
    ["🪿"],
    [randomString(31)],
    [randomString(33)],
  ]) {
    it("bad info hashes", async () => {
      const go = randomGraffitiObject();
      go.channels = [randomString()];
      go.infoHashes = infoHashes;
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
    expect(result?.webId).toBe(go.webId);
    expect(result?.name).toBe(go.name);
    expect(result?.value).toStrictEqual(go.value);
  });

  it("put and get same owner, private", async () => {
    const go = randomGraffitiObject();
    go.acl = [];
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result?.webId).toBe(go.webId);
    expect(result?.name).toBe(go.name);
    expect(result?.value).toStrictEqual(go.value);
  });

  it("put and get public", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, randomString());
    expect(result?.webId).toBe(go.webId);
    expect(result?.name).toBe(go.name);
    expect(result?.value).toStrictEqual(go.value);
  });

  it("put and get private, allowed", async () => {
    const go = randomGraffitiObject();
    const webId = randomString();
    go.acl = [webId];
    await service.putObject(go);
    const result = await service.getObject(go.webId, go.name, webId);
    expect(result?.webId).toBe(go.webId);
    expect(result?.name).toBe(go.name);
    expect(result?.value).toStrictEqual(go.value);
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
    expect(deleted?.value).toStrictEqual(go.value);
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
      { op: "add", path: `/newthing`, value: "new" },
    ]);
    expect(patched?.value).toStrictEqual({
      [Object.keys(go.value)[0]]: 42,
      newthing: "new",
    });

    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result?.value).toStrictEqual(patched?.value);
  });

  it("patch 'increment' with test", async () => {
    const go = randomGraffitiObject();
    go.value = { counter: 1 };
    await service.putObject(go);

    const patched = await service.patchObject(go.webId, go.name, [
      { op: "test", path: "/counter", value: 1 },
      { op: "replace", path: "/counter", value: 2 },
    ]);
    expect(patched?.value).toHaveProperty("counter", 2);
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result?.value).toStrictEqual(patched?.value);

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

  it("invalid patch", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);

    const patch: Operation[] = [
      { op: "add", path: "/root", value: [] },
      { op: "add", path: "/root/2", value: 2 }, // out of bounds
    ];

    try {
      const patched = await service.patchObject(go.webId, go.name, patch);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(400);
    }

    expect.assertions(2);
  });

  it("patch nonexistant object", async () => {
    const patched = await service.patchObject(randomString(), randomString(), [
      { op: "replace", path: "/test", value: 0 },
    ]);

    expect(patched).toBeNull();
  });

  it("concurrent patches", async () => {
    const go = randomGraffitiObject();
    go.value["something"] = 1;
    await service.putObject(go);

    // Patch at the same time
    const jobs: Promise<StoreSchema | null>[] = [];
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

  describe("queries", () => {
    let go: StoreSchema;
    let infoHashes: string[];
    let webId: string;

    beforeEach(() => {
      go = randomGraffitiObject();
      go.channels = [randomString(), randomString()];
      infoHashes = go.channels.map(
        infoHashService.toInfoHash.bind(infoHashService),
      );
      webId = randomString();
    });

    it("get and query basic", async () => {
      await service.putObject(go);
      const iterator = service.queryObjects(infoHashes, webId);
      const result = await iterator.next();
      expect(result.value["value"]).toStrictEqual(go.value);
      expect(result.value["channels"]).toStrictEqual(go.channels);
      expect(result.value["infoHashes"]).toStrictEqual(infoHashes);
    });

    it("get and query authorized", async () => {
      go.acl = [webId];
      await service.putObject(go);
      const iterator = service.queryObjects(infoHashes, webId);
      const result = await iterator.next();
      expect(result.value["value"]).toStrictEqual(go.value);
    });

    it("get and query unauthorized", async () => {
      go.acl = [];
      await service.putObject(go);
      const iterator = service.queryObjects(infoHashes, webId);
      const result = await iterator.next();
      expect(result.done).toBe(true);
    });

    it("get and query implicit authorized", async () => {
      go.acl = [];
      await service.putObject(go);
      const iterator = service.queryObjects(infoHashes, go.webId);
      const result = await iterator.next();
      expect(result.value["value"]).toStrictEqual(go.value);
    });

    it("query no info hashes", async () => {
      const iterator = service.queryObjects([], webId);
      await expect(iterator.next()).resolves.toHaveProperty("done", true);
    });

    it("query one info hash", async () => {
      expect(go.channels.length).toBe(2);
      await service.putObject(go);
      const iterator = service.queryObjects([infoHashes[0]], webId);
      const result = await iterator.next();
      expect(result.value["value"]).toStrictEqual(go.value);
      await expect(iterator.next()).resolves.toHaveProperty("done", true);
    });

    it("query multiple info hashes", async () => {
      await service.putObject(go);
      const iterator = service.queryObjects(
        [randomString(), infoHashes[0], randomString()],
        webId,
      );
      const result = await iterator.next();
      expect(result.value["value"]).toStrictEqual(go.value);
      await expect(iterator.next()).resolves.toHaveProperty("done", true);
    });

    it("query limited", async () => {
      for (let i = 0; i < 10; i++) {
        go.name = randomString();
        await service.putObject(go);
      }

      let count = 0;
      for await (const result of service.queryObjects(infoHashes, webId, {
        limit: 5,
      })) {
        count++;
      }
      expect(count).toBe(5);
    });

    for (const prop of ["name", "webId"]) {
      it(`query for ${prop}`, async () => {
        await service.putObject(go);
        const go2 = randomGraffitiObject();
        go2.name = randomString();
        go2.webId = randomString();
        go2.channels = go.channels;
        await service.putObject(go2);

        const iterator = service.queryObjects(infoHashes, webId, {
          query: {
            properties: {
              [prop]: {
                enum: [go[prop]],
              },
            },
          },
        });
        const result = await iterator.next();
        // Gets the queried name but not the other
        expect(result.value["value"]).toStrictEqual(go.value);
        await expect(iterator.next()).resolves.toHaveProperty("done", true);
      });
    }

    it("query the value", async () => {
      go.value = { test: randomString() };
      await service.putObject(go);
      go.name = randomString();
      go.value = { test: randomString(), something: randomString() };
      await service.putObject(go);
      go.name = randomString();
      go.value = { other: randomString(), something: randomString() };
      await service.putObject(go);

      const counts = {};
      for (const property of ["test", "something", "other"]) {
        let count = 0;
        for await (const result of service.queryObjects(infoHashes, webId, {
          query: {
            properties: {
              value: {
                required: [property],
              },
            },
          },
        })) {
          expect(result.value[property]).toBeDefined();
          count++;
        }
        counts[property] = count;
      }

      expect(counts["test"]).toBe(2);
      expect(counts["something"]).toBe(2);
      expect(counts["other"]).toBe(1);
    });

    it("query for acl", async () => {
      go.acl = [webId];
      await service.putObject(go);
      const iterator = service.queryObjects(infoHashes, webId, {
        query: {
          required: ["acl"],
        },
      });
      await expect(iterator.next()).resolves.toHaveProperty("done", true);
    });

    it("channels, infoHashes, not as owner", async () => {
      go.acl = [webId];
      expect(go.channels.length).toBe(2);
      await service.putObject(go);

      // Only query for one of the infoHashes (there are 2)
      const iterator = service.queryObjects([infoHashes[1]], webId);
      const result = await iterator.next();
      expect(result.value["channels"]).toStrictEqual([go.channels[1]]);
      expect(result.value["infoHashes"]).toStrictEqual([go.infoHashes[1]]);
    });

    it("query for acl, channels, infoHashes, as owner", async () => {
      go.acl = [webId];
      await service.putObject(go);

      for (const property of ["acl", "channels", "infoHashes"]) {
        const iterator = service.queryObjects([infoHashes[1]], go.webId, {
          query: {
            required: [property],
          },
        });
        const result = await iterator.next();
        expect(result.value["value"]).toStrictEqual(go.value);
        expect(result.value[property]).toStrictEqual(go[property]);
      }
    });
  });
});
