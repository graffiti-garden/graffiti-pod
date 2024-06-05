import { Test, TestingModule } from "@nestjs/testing";
import {
  NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import { randomString, solidLogin } from "../test/utils";
import { StoreModule } from "./store.module";
import { RootMongooseModule } from "../app.module";
import { encodeHeaderArray } from "../params/params.utils";
import { Operation } from "fast-json-patch";
import { InfoHash } from "../info-hash/info-hash";

describe("StoreController", () => {
  let app: NestFastifyApplication;
  let solidFetch: typeof fetch;
  let webId: string;
  const port = 3000;
  const baseUrl = `http://localhost:${port}`;

  function toUrl(name: string, webId_: string = webId) {
    return `${baseUrl}/${encodeURIComponent(webId_)}/${encodeURIComponent(name)}`;
  }

  async function request(
    fetch_: typeof fetch,
    url: string,
    method: string,
    options?: {
      body?: any;
      channels?: string[];
      acl?: string[];
    },
  ) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (options?.channels) {
      headers["Channels"] = encodeHeaderArray(options.channels);
    }
    if (options?.acl) {
      headers["Access-Control-List"] = encodeHeaderArray(options.acl);
    }
    const init: RequestInit = { method, headers };
    if (options?.body) {
      init.body = JSON.stringify(options.body);
    }
    return await fetch_(url, init);
  }

  beforeAll(async () => {
    // Login to solid
    const session = await solidLogin();
    solidFetch = session.fetch;
    if (!session.webId) {
      throw new Error("No webId");
    }
    webId = session.webId;
  }, 100000);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [RootMongooseModule, StoreModule],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.listen(3000);
  });

  afterEach(async () => {
    await app.close();
  });

  it("put with normal fetch", async () => {
    const response = await fetch(toUrl(randomString()), {
      method: "PUT",
    });
    expect(response.status).toBe(401);
  });

  it("get non-existant", async () => {
    const response = await fetch(toUrl(randomString()));
    expect(response.status).toBe(404);
  });

  it("put and get", async () => {
    const url = toUrl(randomString());
    const body = { [randomString()]: randomString(), "🪿": "🐣" };
    const channels = [randomString(), "://,🎨", randomString()];
    const dateBefore = new Date();
    const responsePut = await request(solidFetch, url, "PUT", {
      body,
      channels,
    });
    const dateAfter = new Date();
    expect(responsePut.status).toBe(201);

    // Fetch authenticated
    const responseGetAuth = await solidFetch(url);
    expect(responseGetAuth.status).toBe(200);
    expect(responseGetAuth.headers.get("access-control-list")).toBeNull();
    expect(responseGetAuth.headers.get("channels")).toBe(
      encodeHeaderArray(channels),
    );
    expect(responseGetAuth.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    const lastModifiedAuth = responseGetAuth.headers.get(
      "last-modified",
    ) as string;
    expect(new Date(lastModifiedAuth).getTime()).toBeGreaterThan(
      dateBefore.getTime(),
    );
    expect(new Date(lastModifiedAuth).getTime()).toBeLessThan(
      dateAfter.getTime(),
    );
    await expect(responseGetAuth.json()).resolves.toEqual(body);

    // Fetch unauthenticated
    const responseGetUnauth = await fetch(url);
    expect(responseGetUnauth.status).toBe(200);
    await expect(responseGetUnauth.json()).resolves.toEqual(body);
    expect(responseGetUnauth.headers.get("access-control-list")).toBeNull();
    expect(responseGetUnauth.headers.get("channels")).toBeNull();
    expect(responseGetUnauth.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    const lastModifiedUnauth = responseGetAuth.headers.get(
      "last-modified",
    ) as string;
    expect(new Date(lastModifiedUnauth).getTime()).toBeGreaterThan(
      dateBefore.getTime(),
    );
    expect(new Date(lastModifiedUnauth).getTime()).toBeLessThan(
      dateAfter.getTime(),
    );
  });

  it("put and get unauthorized", async () => {
    const url = toUrl(randomString());
    const acl = [randomString()];
    await request(solidFetch, url, "PUT", { acl, body: {} });

    const responseAuth = await solidFetch(url);
    expect(responseAuth.status).toBe(200);
    expect(responseAuth.headers.get("access-control-list")).toBe(
      encodeHeaderArray(acl),
    );
    expect(responseAuth.headers.get("channels")).toBe("");

    const responseUnauth = await fetch(url);
    expect(responseUnauth.status).toBe(404);
    expect(responseUnauth.headers.get("last-modified")).toBeNull();
    expect(responseUnauth.headers.get("channels")).toBeNull();
    expect(responseUnauth.headers.get("access-control-list")).toBeNull();
  });

  it("put invalid body", async () => {
    const url = toUrl(randomString());
    const response = await request(solidFetch, url, "PUT", { body: [] });
    expect(response.status).toBe(422);
  });

  it("patch nonexistant", async () => {
    const response = await request(solidFetch, toUrl(randomString()), "PATCH", {
      body: [],
    });
    expect(response.status).toBe(404);
  });

  it("patch", async () => {
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: { before: "something" } });

    const response = await request(solidFetch, url, "PATCH", {
      body: [
        { op: "remove", path: "/before" },
        { op: "add", path: "/hello", value: "world" },
      ] as Operation[],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("channels")).toBe("");
    await expect(response.json()).resolves.toEqual({ before: "something" });

    const getResponse = await fetch(url);
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("channels")).toBeNull();
    await expect(getResponse.json()).resolves.toEqual({ hello: "world" });
  });

  it("try to patch to invalid", async () => {
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: { hello: "world" } });

    const response = await request(solidFetch, url, "PATCH", {
      body: [
        { op: "remove", path: "/hello" },
        // Try to make it an array
        { op: "add", path: "", value: ["hello", "world"] },
      ] as Operation[],
    });
    expect(response.status).toBe(422);
  });

  it("bad patch operation", async () => {
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: {} });
    const response = await request(solidFetch, url, "PATCH", {
      body: [{ op: "notarealop", path: "/hello" }],
    });
    expect(response.status).toBe(422);
  });

  it("bad patch overall", async () => {
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: {} });
    const response = await request(solidFetch, url, "PATCH", {
      body: { notanarray: true },
    });
    expect(response.status).toBe(400);
  });

  it("patch channels and acl", async () => {
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: {} });
    const response = await request(solidFetch, url, "PATCH", {
      body: [],
      acl: [
        JSON.stringify({
          op: "add",
          path: "",
          value: ["some-acl"],
        }),
      ],
      channels: [
        JSON.stringify({
          op: "add",
          path: "/-",
          value: "some-channel",
        }),
      ],
    });
    expect(response.status).toBe(200);
    const patched = await solidFetch(url);
    expect(patched.status).toBe(200);
    expect(patched.headers.get("channels")).toBe("some-channel");
    expect(patched.headers.get("access-control-list")).toBe("some-acl");
  });

  it("delete non-existant", async () => {
    const response = await request(solidFetch, toUrl(randomString()), "DELETE");
    expect(response.status).toBe(404);
  });

  it("put, delete, get", async () => {
    const body = { [randomString()]: randomString() };
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body });
    const responseDelete = await request(solidFetch, url, "DELETE");
    expect(responseDelete.status).toBe(200);
    expect(await responseDelete.json()).toEqual(body);

    const responseGet = await fetch(url);
    expect(responseGet.status).toBe(404);
  });

  it("query basic", async () => {
    const value = { [randomString()]: randomString() };
    const channels = [randomString(), randomString()];
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: value, channels });
    const obscuredChannels = channels.map<string>((c) =>
      InfoHash.obscureChannel(c),
    );
    const response = await request(solidFetch, baseUrl, "POST", {
      channels: obscuredChannels,
      body: {},
    });
    expect(response.status).toBe(201);
    const responseJson = await response.json();
    expect(Array.isArray(responseJson)).toBe(true);
    expect(responseJson).toHaveLength(1);
    const output = responseJson[0];
    expect(output.value).toEqual(value);
    expect(output.channels.map((c) => c.value).sort()).toEqual(channels.sort());
    expect(output.acl).toBeNull();
    expect(output.tombstone).toBe(false);
  });
});
