import { Test, TestingModule } from "@nestjs/testing";
import { StoreService } from "./store.service";
import { randomBase64 as randomString } from "@graffiti-garden/implementation-local/utilities";
import { HttpException } from "@nestjs/common";
import { encodeURIArray } from "../params/params.utils";
import { describe, it, expect, beforeEach } from "vitest";
import type { GraffitiObjectBase } from "@graffiti-garden/api";
import type { FastifyReply } from "fastify";

function responseMock() {
  const headers = new Map<string, string>();
  return {
    header(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    statusCode: 400,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  } as FastifyReply;
}

function randomGraffitiObject(): GraffitiObjectBase {
  return {
    actor: randomString(),
    name: randomString(),
    value: { [randomString()]: randomString() },
    lastModified: new Date().getTime(),
    source: randomString(),
    tombstone: false,
    channels: [],
  };
}

describe("StoreService", () => {
  let service: StoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoreService],
    }).compile();

    service = module.get<StoreService>(StoreService);
  });

  it("unauthorized", async () => {
    try {
      service.validateActor(randomString(), null);
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(401);
    }
    expect.assertions(2);
  });

  it("forbidden", async () => {
    try {
      service.validateActor(randomString(), randomString());
    } catch (e: any) {
      expect(e).toBeInstanceOf(HttpException);
      expect(e.status).toBe(403);
    }
    expect.assertions(2);
  });

  it("authorized", async () => {
    const webId = randomString();
    expect(service.validateActor(webId, webId)).toBeUndefined();
  });

  it("return with channels and allowed", async () => {
    const go = randomGraffitiObject();
    go.channels = [randomString(), randomString()];
    go.allowed = [randomString(), randomString()];
    const response = responseMock();
    const returned = service.returnObject(go, response, "get");
    expect(response.statusCode).toBe(200);
    expect(returned).toStrictEqual(go.value);
    expect(response.getHeader("Channels")).toBe(encodeURIArray(go.channels));
    expect(response.getHeader("Allowed")).toBe(encodeURIArray(go.allowed));
    expect(response.getHeader("Last-Modified")).toBe(
      new Date(go.lastModified).toUTCString(),
    );
    expect(response.getHeader("Last-Modified-Ms")).toBe(
      new Date(go.lastModified).getUTCMilliseconds().toString(),
    );
  });

  it("return with empty channels and allowed", async () => {
    const go = randomGraffitiObject();
    go.channels = [];
    go.allowed = undefined;
    const response = responseMock();
    const returned = service.returnObject(go, response, "get");
    expect(response.statusCode).toBe(200);
    expect(returned).toStrictEqual(go.value);
    expect(response.getHeader("Channels")).toBeUndefined();
    expect(response.getHeader("Access-Control-List")).toBeUndefined();
    expect(response.getHeader("Last-Modified")).toBe(
      new Date(go.lastModified).toUTCString(),
    );
    expect(response.getHeader("Last-Modified-Ms")).toBe(
      new Date(go.lastModified).getUTCMilliseconds().toString(),
    );
  });

  it("return put object", async () => {
    const go = randomGraffitiObject();
    go.value = {};
    go.channels = [];
    go.allowed = undefined;
    const response = responseMock();
    service.returnObject(go, response, "put");
    expect(response.statusCode).toBe(201);
  });

  it("return deleted object", async () => {
    const go = randomGraffitiObject();
    go.tombstone = true;
    const response = responseMock();
    service.returnObject(go, response, "get");
    expect(response.statusCode).toBe(410);
  });
});
