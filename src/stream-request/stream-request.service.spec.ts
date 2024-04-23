import { Test, TestingModule } from "@nestjs/testing";
import { StreamRequestService } from "./stream-request.service";
import { RootMongooseModule } from "../app.module";
import { StreamRequestMongooseModule } from "./stream-request.schema";
import { randomString } from "../test/utils";
jest.mock("../constants", () => ({
  STREAM_REQUEST_EXPIRE_TIME: 500,
}));
import { STREAM_REQUEST_EXPIRE_TIME } from "../constants";

describe("StreamRequestService", () => {
  let service: StreamRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, StreamRequestMongooseModule],
      providers: [StreamRequestService],
    }).compile();

    service = module.get<StreamRequestService>(StreamRequestService);
  });

  it("get an invalid request", async () => {
    await expect(
      service.verifyRequest(randomString(), randomString()),
    ).resolves.toBe(false);
  });

  it("make a request (plus replay)", async () => {
    const webId = randomString();
    const challenge = await service.makeRequest(webId);
    await expect(service.verifyRequest(webId, challenge)).resolves.toBe(true);
    await expect(service.verifyRequest(webId, challenge)).resolves.toBe(false);
  });

  it("almost expire request", async () => {
    const webId = randomString();
    const challenge = await service.makeRequest(webId);
    await new Promise((resolve) =>
      setTimeout(resolve, STREAM_REQUEST_EXPIRE_TIME * 0.9),
    );
    await expect(service.verifyRequest(webId, challenge)).resolves.toBe(true);
  });

  it("expire a request", async () => {
    const webId = randomString();
    const challenge = await service.makeRequest(webId);
    await new Promise((resolve) =>
      setTimeout(resolve, STREAM_REQUEST_EXPIRE_TIME * 1.1),
    );
    await expect(service.verifyRequest(webId, challenge)).resolves.toBe(false);
  });
});
