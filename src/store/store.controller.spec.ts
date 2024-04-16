import { Test, TestingModule } from "@nestjs/testing";
import { StoreController } from "./store.controller";
import { RootMongooseModule } from "../app.module";
import { GraffitiObjectMongooseModule } from "../schemas/object.schema";
import { StoreService } from "./store.service";
import { randomString, responseMock } from "../test/utils";

describe("StoreController", () => {
  let controller: StoreController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, GraffitiObjectMongooseModule],
      controllers: [StoreController],
      providers: [StoreService],
    }).compile();

    controller = module.get<StoreController>(StoreController);
  });

  it("get nonexistant object", async () => {
    await expect(
      controller.getObject("webid", "name", "webid", responseMock()),
    ).rejects.toThrow();
  });

  it("put without webid", async () => {
    await expect(
      controller.putObject(
        randomString(),
        randomString(),
        {},
        [],
        undefined,
        null,
      ),
    ).rejects.toThrow();
  });

  it("put with non-matching webid", async () => {
    await expect(
      controller.putObject(
        randomString(),
        randomString(),
        {},
        [],
        undefined,
        randomString(),
      ),
    ).rejects.toThrow();
  });

  it("put public and get without webid", async () => {
    const webId = randomString();
    const name = randomString();
    const value = { [randomString()]: randomString() };
    await controller.putObject(
      webId,
      name,
      value,
      [randomString()],
      undefined,
      webId,
    );

    const reply = responseMock();
    const result = await controller.getObject(webId, name, null, reply);
    expect(result).toStrictEqual(value);
    expect(reply.getHeader("Channels")).toBeUndefined();
    expect(reply.getHeader("Access-Control-List")).toBeUndefined();
  });

  for (const [type, acl] of [
    ["public", undefined],
    ["private", []],
    ["private", [randomString(), randomString()]],
  ]) {
    it(`put ${type} and get with owner webid`, async () => {
      const webId = randomString();
      const name = randomString();
      const value = { [randomString()]: randomString() };
      const channels = [randomString()];
      await controller.putObject(
        webId,
        name,
        value,
        channels,
        acl as string[],
        webId,
      );

      const reply = responseMock();
      const result = await controller.getObject(webId, name, webId, reply);
      expect(result).toStrictEqual(value);
      expect(reply.getHeader("Channels")).toStrictEqual(channels);
      expect(reply.getHeader("Access-Control-List")).toStrictEqual(acl);
    });
  }

  it("put private and get without webid", async () => {
    const webId = randomString();
    const name = randomString();
    await controller.putObject(webId, name, {}, [], [], webId);

    await expect(
      controller.getObject(webId, name, null, responseMock()),
    ).rejects.toThrow();
  });

  it("put private and get with allowed webid", async () => {
    const webId = randomString();
    const name = randomString();
    const allowedWebId = randomString();
    const value = { [randomString()]: randomString() };
    await controller.putObject(
      webId,
      name,
      value,
      [],
      [allowedWebId, randomString()],
      webId,
    );

    const reply = responseMock();
    const result = await controller.getObject(webId, name, allowedWebId, reply);
    expect(result).toStrictEqual(value);
    expect(reply.getHeader("Channels")).toBeUndefined();
    expect(reply.getHeader("Access-Control-List")).toBeUndefined();
  });

  it("put private and get with disallowed webid", async () => {
    const webId = randomString();
    const name = randomString();
    await controller.putObject(webId, name, {}, [], [randomString()], webId);

    await expect(
      controller.getObject(webId, name, randomString(), responseMock()),
    ).rejects.toThrow();
  });
});
