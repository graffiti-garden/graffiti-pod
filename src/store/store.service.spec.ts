import { Test, TestingModule } from "@nestjs/testing";
import { StoreService } from "./store.service";
import { RootMongooseModule } from "../app.module";
import { StoreMongooseModule, channelSchemaToChannels } from "./store.schema";
import {
  randomString,
  randomGraffitiObject,
  responseMock,
} from "../test/utils";
import { HttpException } from "@nestjs/common";
import { Operation } from "fast-json-patch";
import { StoreSchema, channelsToChannelSchema } from "./store.schema";
import { encodeHeaderArray } from "../params/params.utils";

describe("StoreService", () => {
  let service: StoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, StoreMongooseModule],
      providers: [StoreService],
    }).compile();

    service = module.get<StoreService>(StoreService);
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
    go.channels = channelsToChannelSchema([randomString(), randomString()]);
    go.acl = [randomString(), randomString()];
    go.lastModified = new Date();
    const response = responseMock();
    const returned = service.returnObject(go, go.webId, response);
    expect(returned).toStrictEqual(go.value);
    expect(response.getHeader("Channels")).toBe(
      encodeHeaderArray(channelSchemaToChannels(go.channels)),
    );
    expect(response.getHeader("Access-Control-List")).toBe(
      encodeHeaderArray(go.acl),
    );
    expect(response.getHeader("Last-Modified")).toBe(
      go.lastModified.toISOString(),
    );
  });

  it("return different owner", async () => {
    const go = randomGraffitiObject();
    go.channels = channelsToChannelSchema([randomString(), randomString()]);
    go.acl = [randomString(), randomString()];
    go.lastModified = new Date();
    const response = responseMock();
    const returned = service.returnObject(go, randomString(), response);
    expect(returned).toStrictEqual(go.value);
    expect(response.getHeader("Channels")).toBeUndefined();
    expect(response.getHeader("Access-Control-List")).toBeUndefined();
    expect(response.getHeader("Last-Modified")).toBe(
      go.lastModified.toISOString(),
    );
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
    (go) => (go.channels = ["a", "a"]),
    (go) => (go.channels = [{ value: "a" }]),
    (go) => (go.channels = [{ infoHash: randomString(32) }]),
    (go) => (go.channels = [{ value: "a", infoHash: randomString(31) }]),
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
    go.channels = channelsToChannelSchema([
      randomString(),
      randomString(),
      "🪿🕰️",
    ]);
    await service.putObject(go);
  });

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
    const dateBefore = new Date();
    await new Promise((r) => setTimeout(r, 100));
    await service.putObject(go);
    await new Promise((r) => setTimeout(r, 100));
    const dateAfter = new Date();
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result?.webId).toBe(go.webId);
    expect(result?.name).toBe(go.name);
    expect(result?.value).toStrictEqual(go.value);
    expect(result?.lastModified.getTime()).toBeGreaterThan(
      dateBefore.getTime(),
    );
    expect(result?.lastModified.getTime()).toBeLessThan(dateAfter.getTime());
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
    const dateBefore = new Date();
    await service.putObject(go);
    const dateAfter = new Date();
    const result = await service.getObject(go.webId, go.name, randomString());
    expect(result?.webId).toBe(go.webId);
    expect(result?.name).toBe(go.name);
    expect(result?.value).toStrictEqual(go.value);
    expect(result?.lastModified.getTime()).toBeGreaterThanOrEqual(
      dateBefore.getTime(),
    );
    expect(result?.lastModified.getTime()).toBeLessThanOrEqual(
      dateAfter.getTime(),
    );
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
    const result = (await service.getObject(
      go.webId,
      go.name,
      go.webId,
    )) as StoreSchema;

    await new Promise<void>((r) => setTimeout(r, 200));

    const previous = await service.patchObject(go.webId, go.name, {
      value: [
        { op: "replace", path: `/${Object.keys(go.value)[0]}`, value: 42 },
        { op: "add", path: `/newthing`, value: "new" },
      ],
    });
    expect(previous?.value).toStrictEqual(result.value);

    const resultPatched = await service.getObject(go.webId, go.name, go.webId);
    expect(resultPatched?.value).toStrictEqual({
      [Object.keys(go.value)[0]]: 42,
      newthing: "new",
    });
    expect(resultPatched?.lastModified.getTime()).toBeGreaterThan(
      result.lastModified.getTime(),
    );
  });

  it("patch 'increment' with test", async () => {
    const go = randomGraffitiObject();
    go.value = { counter: 1 };
    await service.putObject(go);

    const previous = await service.patchObject(go.webId, go.name, {
      value: [
        { op: "test", path: "/counter", value: 1 },
        { op: "replace", path: "/counter", value: 2 },
      ],
    });
    expect(previous?.value).toStrictEqual(go.value);
    const result = await service.getObject(go.webId, go.name, go.webId);
    expect(result?.value).toHaveProperty("counter", 2);

    try {
      await service.patchObject(go.webId, go.name, {
        value: [
          { op: "test", path: "/counter", value: 1 },
          { op: "replace", path: "/counter", value: 2 },
        ],
      });
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
      await service.patchObject(go.webId, go.name, {
        value: patch,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(422);
    }

    expect.assertions(2);
  });

  it("patch nonexistant object", async () => {
    const patched = await service.patchObject(randomString(), randomString(), {
      value: [{ op: "replace", path: "/test", value: 0 }],
    });

    expect(patched).toBeNull();
  });

  it.skip("concurrent patches", async () => {
    const go = randomGraffitiObject();
    go.value["something"] = 1;
    await service.putObject(go);

    // Patch at the same time
    const jobs: Promise<StoreSchema | null>[] = [];
    for (let i = 0; i < 1000; i++) {
      jobs.push(
        service.patchObject(go.webId, go.name, {
          value: [{ op: "replace", path: "/something", value: 0 }],
        }),
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

  it("patch acl and channels", async () => {
    const go = randomGraffitiObject();
    go.channels = channelsToChannelSchema([randomString(), randomString()]);
    await service.putObject(go);

    const newChannel = randomString();
    await service.patchObject(go.webId, go.name, {
      acl: [{ op: "add", path: "", value: [] }],
      channels: [{ op: "add", path: "/-", value: newChannel }],
    });
    const patched = await service.getObject(go.webId, go.name, go.webId);

    expect(patched?.channels[2].value).toEqual(newChannel);
    expect(patched?.acl).toEqual([]);
  });

  it("patch channels to be null", async () => {
    const go = randomGraffitiObject();
    await service.putObject(go);
    try {
      await service.patchObject(go.webId, go.name, {
        channels: [{ op: "replace", path: "", value: null }],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(422);
    }
    expect.assertions(2);
  });

  it("patch makes channels non-unique", async () => {
    const go = randomGraffitiObject();
    go.channels = channelsToChannelSchema([randomString(), randomString()]);
    await service.putObject(go);
    try {
      await service.patchObject(go.webId, go.name, {
        channels: [{ op: "add", path: "/-", value: go.channels[0] }],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(422);
    }
    expect.assertions(2);
  });

  it("patch channels if an object", async () => {
    const go = randomGraffitiObject();
    go.channels = channelsToChannelSchema([randomString(), randomString()]);
    await service.putObject(go);
    try {
      await service.patchObject(go.webId, go.name, {
        channels: [{ op: "add", path: "/something", value: randomString() }],
      });
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(422);
    }
    expect.assertions(2);
  });

  describe("queries", () => {
    let go: StoreSchema;
    let infoHashes: string[];
    let webId: string;

    beforeEach(() => {
      go = randomGraffitiObject();
      go.channels = channelsToChannelSchema([randomString(), randomString()]);
      infoHashes = go.channels.map<string>((c) => c.infoHash);
      webId = randomString();
    });

    it("get and query basic", async () => {
      await service.putObject(go);
      const iterator = service.queryObjects(infoHashes, webId);
      const result = await iterator.next();
      expect(result.value["value"]).toStrictEqual(go.value);
      expect(result.value["channels"]).toStrictEqual(go.channels);
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

    it("query order", async () => {
      await service.putObject(go);
      const go2 = randomGraffitiObject();
      go2.channels = go.channels;
      await service.putObject(go2);

      // Objects appear in order they were placed
      const iterator = service.queryObjects(infoHashes, webId);
      const result1 = await iterator.next();
      expect(result1.value["value"]).toEqual(go.value);
      const result2 = await iterator.next();
      expect(result2.value["value"]).toEqual(go2.value);
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

    it("invalid limit", async () => {
      const iterator = service.queryObjects(infoHashes, webId, {
        limit: -1,
      });
      try {
        await iterator.next();
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.status).toBe(422);
      }
    });

    it("invalid skip", async () => {
      const iterator = service.queryObjects(infoHashes, webId, {
        skip: -1,
      });
      try {
        await iterator.next();
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.status).toBe(422);
      }
    });

    it("invalid query", async () => {
      const iterator = service.queryObjects(infoHashes, webId, {
        query: {
          asdf: {},
        },
      });
      try {
        await iterator.next();
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect(e.status).toBe(422);
      }
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
    });

    it("query for acl, channels as owner", async () => {
      go.acl = [webId];
      await service.putObject(go);

      for (const property of ["acl", "channels"]) {
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

    it("query with ifModifiedSince", async () => {
      await service.putObject(go);
      const put = await service.getObject(go.webId, go.name, go.webId);
      if (!put) throw new Error("Object not found");
      const iteratorBefore = service.queryObjects(infoHashes, webId, {
        ifModifiedSince: put.lastModified,
      });
      const resultBefore = await iteratorBefore.next();
      expect(resultBefore.value["value"]).toStrictEqual(go.value);
      const iteratorAfter = service.queryObjects(infoHashes, webId, {
        ifModifiedSince: new Date(put.lastModified.getTime() + 1),
      });
      await expect(iteratorAfter.next()).resolves.toHaveProperty("done", true);
    });

    it("query with ifModifiedSince", async () => {
      await service.putObject(go);
      const put = await service.getObject(go.webId, go.name, go.webId);
      const lastModified = put?.lastModified;

      const go2 = randomGraffitiObject();
      go2.channels = go.channels;
      await service.putObject(go2);
      const put2 = await service.getObject(go2.webId, go2.name, go2.webId);
      const lastModified2 = put2?.lastModified;
      expect(lastModified?.getTime()).toBeLessThan(lastModified2?.getTime()!);

      const iterator = service.queryObjects(infoHashes, webId, {
        ifModifiedSince: new Date(lastModified!.getTime() + 1),
      });
      const result1 = await iterator.next();
      expect(result1.value?.value).toStrictEqual(go2.value);
      await expect(iterator.next()).resolves.toHaveProperty("done", true);
    });

    it("query for deleted content", async () => {
      await service.putObject(go);
      await service.deleteObject(go.webId, go.name);
      const iterator = service.queryObjects(infoHashes, null);
      const result = await iterator.next();
      expect(result.value?.tombstone).toBe(true);
      expect(result.value?.value).toBe(undefined);
      expect(await iterator.next()).toHaveProperty("done", true);
    });

    it("query for changed ACL", async () => {
      await service.putObject(go);
      await service.patchObject(go.webId, go.name, {
        acl: [{ op: "add", path: "", value: [] }],
      });
      const iterator = service.queryObjects(infoHashes, null);
      const result = await iterator.next();
      expect(result.value?.tombstone).toBe(true);
      expect(result.value?.value).toBe(undefined);
      expect(await iterator.next()).toHaveProperty("done", true);
    });

    it("query for changed channels", async () => {
      await service.putObject(go);
      await service.patchObject(go.webId, go.name, {
        channels: [{ op: "replace", path: "", value: [] }],
      });
      const iterator = service.queryObjects(infoHashes, null);
      const result = await iterator.next();
      expect(result.value?.tombstone).toBe(true);
      expect(result.value?.value).toBe(undefined);
      expect(await iterator.next()).toHaveProperty("done", true);
    });
  });

  it("list no channels", async () => {
    const channelsIterator = service.listChannels(randomString());
    await expect(channelsIterator.next()).resolves.toHaveProperty("done", true);
  });

  it("list all channels", async () => {
    const webId = randomString();
    const go1 = randomGraffitiObject();
    go1.channels = channelsToChannelSchema([randomString(), randomString()]);
    go1.webId = webId;
    const go2 = randomGraffitiObject();
    go2.channels = channelsToChannelSchema([
      randomString(),
      go1.channels[1].value,
    ]);
    go2.webId = webId;

    await service.putObject(go1);
    await service.putObject(go2);

    const channelsIterator = service.listChannels(webId);
    const channels = new Map<string, Date>();
    let count = 0;
    for await (const result of channelsIterator) {
      channels.set(result.channel, result.lastModified);
      count++;
    }
    expect(channels.size).toBe(3);
    expect(channels.size).toEqual(count);
    expect(channels.has(go1.channels[0].value)).toBe(true);
    expect(channels.has(go1.channels[1].value)).toBe(true);
    expect(channels.has(go2.channels[0].value)).toBe(true);
    expect(channels.has(go2.channels[1].value)).toBe(true);
    expect(channels.get(go2.channels[0].value)).toEqual(
      channels.get(go2.channels[1].value),
    );
    expect(channels.get(go1.channels[0].value)).not.toEqual(
      channels.get(go1.channels[1].value),
    );
  });

  it("list channels modified since", async () => {
    const webId = randomString();
    const go = randomGraffitiObject();
    go.webId = webId;
    go.channels = channelsToChannelSchema([randomString(), randomString()]);
    await service.putObject(go);

    const now = new Date();
    const firstIterator = service.listChannels(webId, {
      ifModifiedSince: now,
    });
    await expect(firstIterator.next()).resolves.toHaveProperty("done", true);

    const go2 = randomGraffitiObject();
    go2.webId = webId;
    go2.channels = [
      ...go.channels,
      ...channelsToChannelSchema([randomString(), randomString()]),
    ];
    await service.putObject(go2);

    const secondIterator = service.listChannels(webId, {
      ifModifiedSince: now,
    });
    const channels = new Map<string, Date>();
    let count = 0;
    for await (const result of secondIterator) {
      channels.set(result.channel, result.lastModified);
      count++;
    }
    expect(channels.size).toBe(4);
    expect(channels.size).toEqual(count);
    for (const channel of go2.channels) {
      expect(channels.has(channel.value)).toBe(true);
      expect(channels.get(channel.value)).toEqual(
        channels.get(go2.channels[0].value),
      );
    }
  });
});
