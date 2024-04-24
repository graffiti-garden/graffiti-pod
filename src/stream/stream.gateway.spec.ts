import { Test, TestingModule } from "@nestjs/testing";
import { StreamGateway } from "./stream.gateway";
import { RootMongooseModule } from "../app.module";
import { StreamRequestMongooseModule } from "../stream-request/stream-request.schema";
import { StreamRequestService } from "../stream-request/stream-request.service";

describe("StreamGateway", () => {
  let gateway: StreamGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, StreamRequestMongooseModule],
      providers: [StreamRequestService, StreamGateway],
    }).compile();

    gateway = module.get<StreamGateway>(StreamGateway);
  });

  it("should be defined", () => {
    expect(gateway).toBeDefined();
  });
});
