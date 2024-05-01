import { Test, TestingModule } from "@nestjs/testing";
import { StreamGateway } from "./stream.gateway";
import { RootMongooseModule } from "../app.module";
import { StreamRequestService } from "../stream-request/stream-request.service";
import { InfoHashService } from "../info-hash/info-hash.service";
import { randomGraffitiObject, randomString } from "../test/utils";
import { Socket, io } from "socket.io-client";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { StreamRequestModule } from "../stream-request/stream-request.module";
import { StoreModule } from "../store/store.module";
import { StoreService } from "../store/store.service";

describe("StreamGateway", () => {
  let streamRequest: StreamRequestService;
  let infoHashService: InfoHashService;
  let storeService: StoreService;
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, StreamRequestModule, StoreModule],
      providers: [InfoHashService, StreamGateway],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.listen(3000);

    storeService = module.get<StoreService>(StoreService);
    streamRequest = app.get<StreamRequestService>(StreamRequestService);
    infoHashService = module.get<InfoHashService>(InfoHashService);
  });

  afterEach(async () => {
    await app.close();
  });

  it("connect without query", async () => {
    const ioClient = io("http://localhost:3000");
    await new Promise<void>((resolve) => {
      ioClient.on("initialize", (data) => {
        expect(data).toHaveProperty("type", "error");
        expect(data).toHaveProperty("message", "Invalid request");
      });
      ioClient.on("disconnect", () => resolve());
    });
    expect.assertions(2);
  });

  it("connect with invalid query", async () => {
    const ioClient = io("http://localhost:3000", {
      query: {
        webId: randomString(),
        challenge: randomString(),
      },
    });
    await new Promise<void>((resolve) => {
      ioClient.on("initialize", (data) => {
        expect(data).toHaveProperty("type", "error");
        expect(data).toHaveProperty("message", "Request verification failed");
      });
      ioClient.on("disconnect", () => resolve());
    });
    expect.assertions(2);
  });

  describe("valid requests", () => {
    let webId: string;
    let challenge: string;
    let ioClient: Socket;

    beforeEach(async () => {
      webId = randomString();
      challenge = await streamRequest.makeRequest(webId);
      ioClient = io("http://localhost:3000", {
        query: {
          webId,
          challenge,
        },
      });
      await new Promise<void>((resolve) => {
        ioClient.on("initialize", (data) => {
          expect(data).toHaveProperty("type", "success");
          resolve();
        });
      });
    });

    afterEach(() => {
      ioClient.disconnect();
    });

    it("null query", async () => {
      ioClient.emit("query", "");
      await new Promise<void>((resolve) => {
        ioClient.on("query", (data) => {
          expect(data).toHaveProperty("type", "error");
          resolve();
        });
      });
    });

    it("bad pok", async () => {
      const id = randomString();
      ioClient.emit("query", {
        id,
        infoHashes: [randomString(32)],
        poks: [randomString(64)],
      });
      await new Promise<void>((resolve) => {
        ioClient.on(id, (data) => {
          expect(data).toHaveProperty("type", "error");
          resolve();
        });
      });
    });

    it("empty request", async () => {
      const id = randomString();
      const channel = randomString();
      const infoHash = infoHashService.toInfoHash(channel);
      const pok = infoHashService.toPok(channel, challenge);
      ioClient.emit("query", {
        id,
        infoHashes: [infoHash],
        poks: [pok],
      });
      await new Promise<void>((resolve) => {
        ioClient.on(id, (data) => {
          expect(data).toHaveProperty("type", "complete");
          resolve();
        });
      });
    });

    it("get unauthorized, no query", async () => {
      const channel = randomString();
      const object1 = randomGraffitiObject();
      object1.channels = [channel, randomString()];
      await storeService.putObject(object1);
      const object2 = randomGraffitiObject();
      object2.channels = [randomString(), channel, randomString()];
      await storeService.putObject(object2);

      const id = randomString();
      const infoHash = infoHashService.toInfoHash(channel);
      const pok = infoHashService.toPok(channel, challenge);
      ioClient.emit("query", {
        id,
        infoHashes: [infoHash],
        poks: [pok],
      });

      let updateCount = 0;
      await new Promise<void>((resolve) => {
        ioClient.on(id, (data) => {
          if (data.type === "update") {
            // Infohashes and channels are filtered
            // to only what the user has supplied poks for
            expect(data.acl).toBeUndefined();
            expect(data.channels).toEqual([channel]);
            expect(data.infoHashes).toEqual([infoHash]);
            if (data.name === object1.name) {
              expect(data.webId).toBe(object1.webId);
              expect(data.value).toEqual(object1.value);
            } else if (data.name === object2.name) {
              expect(data.webId).toBe(object2.webId);
              expect(data.value).toEqual(object2.value);
            } else {
              fail();
            }
            updateCount++;
          }
          if (data.type === "complete") {
            resolve();
          }
        });
      });
      expect(updateCount).toBe(2);
    });

    it("query modified since", async () => {
      const objectBefore = randomGraffitiObject();
      const channel = randomString();
      objectBefore.channels = [channel, randomString()];
      await storeService.putObject(objectBefore);

      const infoHash = infoHashService.toInfoHash(channel);
      const pok = infoHashService.toPok(channel, challenge);

      const idBefore = randomString();
      const now = new Date();
      ioClient.emit("query", {
        id: idBefore,
        infoHashes: [infoHash],
        poks: [pok],
        modifiedSince: now,
      });

      await new Promise<void>((resolve) => {
        ioClient.on(idBefore, (data) => {
          expect(data.type).toBe("complete");
          resolve();
        });
      });

      const objectAfter = randomGraffitiObject();
      objectAfter.channels = [channel, randomString()];
      await storeService.putObject(objectAfter);

      const idAfter = randomString();
      ioClient.emit("query", {
        id: idAfter,
        infoHashes: [infoHash],
        poks: [pok],
        modifiedSince: now,
      });

      let updateCount = 0;
      await new Promise<void>((resolve) => {
        ioClient.on(idAfter, (data) => {
          if (data.type === "update") {
            updateCount++;
            expect(data.name).toBe(objectAfter.name);
          } else {
            resolve();
          }
        });
      });
      expect(updateCount).toBe(1);
    });

    it("stream ls bad modified since", async () => {
      const id = randomString();
      ioClient.emit("ls", {
        id,
        modifiedSince: "bad date",
      });
      await new Promise<void>((resolve) => {
        ioClient.on(id, (data) => {
          expect(data).toHaveProperty("type", "error");
          resolve();
        });
      });
    });

    it("stream ls", async () => {
      const go1 = randomGraffitiObject();
      go1.channels = [randomString(), randomString()];
      go1.webId = webId;
      await storeService.putObject(go1);

      const go2 = randomGraffitiObject();
      go2.channels = [go1.channels[0], randomString()];
      go2.webId = webId;
      await storeService.putObject(go2);

      const id = randomString();
      ioClient.emit("ls", {
        id,
      });

      let count = 0;
      const channels = new Map<string, Date>();
      await new Promise<void>((resolve) => {
        ioClient.on(id, (data) => {
          if (data.type === "update") {
            count++;
            channels.set(data.channel, new Date(data.lastModified));
          } else {
            resolve();
          }
        });
      });

      expect(count).toEqual(channels.size);
      expect(count).toBe(3);
      for (const channel of [...go1.channels, ...go2.channels]) {
        expect(channels.has(channel)).toBe(true);
      }
      expect(channels.get(go1.channels[0])!.getTime()).toBeGreaterThan(
        channels.get(go1.channels[1])!.getTime(),
      );
      expect(channels.get(go2.channels[0])!.getTime()).toEqual(
        channels.get(go2.channels[1])!.getTime(),
      );
    });
  });
});
