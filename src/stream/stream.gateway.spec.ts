import { Test, TestingModule } from "@nestjs/testing";
import { StreamGateway } from "./stream.gateway";
import { RootMongooseModule } from "../app.module";
import { StreamRequestService } from "../stream-request/stream-request.service";
import { InfoHashService } from "../info-hash/info-hash.service";
import { randomString } from "../test/utils";
import { Socket, io } from "socket.io-client";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { StreamRequestModule } from "../stream-request/stream-request.module";
import { StoreModule } from "../store/store.module";

describe("StreamGateway", () => {
  let streamRequest: StreamRequestService;
  let infoHashService: InfoHashService;
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
        ioClient.on(`query:${id}`, (data) => {
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
        ioClient.on(`query:${id}`, (data) => {
          expect(data).toHaveProperty("type", "complete");
          resolve();
        });
      });
    });
  });
});
