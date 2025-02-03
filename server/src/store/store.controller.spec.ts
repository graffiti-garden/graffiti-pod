import { Test, TestingModule } from "@nestjs/testing";
import {
  type NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { randomBase64 as randomString } from "@graffiti-garden/implementation-local/utilities";
import { solidLogin } from "../test/utils";
import { StoreModule } from "./store.module";
import { encodeURIArray } from "../params/params.utils";
import { GraffitiPatch } from "@graffiti-garden/api";

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
      schema?: any;
      channels?: string[];
      allowed?: string[];
    },
  ) {
    url += "?";
    const headers = new Headers();
    const init: RequestInit = { method, headers };
    if (options?.body) {
      headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(options.body);
    }
    if (options?.channels) {
      url += "channels=" + encodeURIArray(options.channels) + "&";
    }
    if (options?.allowed) {
      url += "allowed=" + encodeURIArray(options.allowed) + "&";
    }
    if (options?.schema) {
      url +=
        "schema=" + encodeURIComponent(JSON.stringify(options.schema)) + "&";
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
      imports: [StoreModule],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.listen(3000);
  }, 100000);

  afterEach(async () => {
    await app.close();
  }, 100000);

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
    const dateBefore = new Date().toUTCString();
    const responsePut = await request(solidFetch, url, "PUT", {
      body,
      channels,
    });
    const dateAfter = new Date().toUTCString();
    expect(responsePut.status).toBe(201);

    // Fetch authenticated
    const responseGetAuth = await solidFetch(url);
    expect(responseGetAuth.status).toBe(200);
    expect(responseGetAuth.headers.get("allowed")).toBeNull();
    expect(responseGetAuth.headers.get("channels")).toBe(
      encodeURIArray(channels),
    );
    expect(responseGetAuth.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    const lastModifiedAuth = responseGetAuth.headers.get(
      "last-modified",
    ) as string;
    expect(new Date(lastModifiedAuth).getTime()).toBeGreaterThanOrEqual(
      new Date(dateBefore).getTime(),
    );
    expect(new Date(lastModifiedAuth).getTime()).toBeLessThanOrEqual(
      new Date(dateAfter).getTime(),
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
    expect(new Date(lastModifiedUnauth).getTime()).toBeGreaterThanOrEqual(
      new Date(dateBefore).getTime(),
    );
    expect(new Date(lastModifiedUnauth).getTime()).toBeLessThanOrEqual(
      new Date(dateAfter).getTime(),
    );
  });

  it("put and get unauthorized", async () => {
    const url = toUrl(randomString());
    const allowed = [randomString()];
    const channels = [randomString()];
    await request(solidFetch, url, "PUT", { allowed, channels, body: {} });

    const responseAuth = await solidFetch(url);
    expect(responseAuth.status).toBe(200);
    expect(responseAuth.headers.get("allowed")).toBe(encodeURIArray(allowed));
    expect(responseAuth.headers.get("channels")).toBe(encodeURIArray(channels));

    const responseUnauth = await fetch(url);
    expect(responseUnauth.status).toBe(404);
    expect(responseUnauth.headers.get("last-modified")).toBeNull();
    expect(responseUnauth.headers.get("channels")).toBeNull();
    expect(responseUnauth.headers.get("allowed")).toBeNull();
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
      ] as GraffitiPatch["value"],
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("channels")).toBeNull();
    expect(response.headers.get("allowed")).toBeNull();
    await expect(response.json()).resolves.toEqual({ before: "something" });

    const getResponse = await fetch(url);
    expect(getResponse.status).toBe(200);
    expect(getResponse.headers.get("channels")).toBeNull();
    expect(getResponse.headers.get("allowed")).toBeNull();
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
      ] as GraffitiPatch["value"],
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
    expect(response.status).toBe(422);
  });

  it("patch channels and acl", async () => {
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: {} });
    const response = await request(solidFetch, url, "PATCH", {
      allowed: [
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
    expect(patched.headers.get("allowed")).toBe("some-acl");
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
    expect(responseGet.status).toBe(410);
    const value = await responseGet.json();
    expect(value).toEqual(body);
    expect(responseGet.headers.get("last-modified")).toEqual(
      responseDelete.headers.get("last-modified"),
    );
    expect(responseGet.headers.get("last-modified-ms")).toEqual(
      responseDelete.headers.get("last-modified-ms"),
    );
  });

  it("discover empty", async () => {
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels: [],
    });
    expect(response.status).toBe(204);
    const output = await response.text();
    expect(output.length).toBe(0);
  });

  it("discover single", async () => {
    const value = { [randomString()]: randomString() };
    const channels = [randomString(), randomString()];
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: value, channels });
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
    });
    expect(response.status).toBe(200);
    const output = await response.json();
    expect(output.value).toEqual(value);
    expect(output.channels.sort()).toEqual(channels.sort());
    expect(output.allowed).toBeUndefined();
    expect(output.tombstone).toBe(false);
  });

  it("discover multiple", async () => {
    const value1 = { [randomString()]: randomString() + "alskdjfk\n\n\\n" };
    const value2 = { [randomString()]: randomString() + "\n😏" };
    const channels1 = [randomString(), randomString()];
    const channels2 = [randomString(), channels1[0]];
    const name1 = randomString();
    const name2 = randomString();
    const putted1 = await request(solidFetch, toUrl(name1), "PUT", {
      body: value1,
      channels: channels1,
    });
    const putted2 = await request(solidFetch, toUrl(name2), "PUT", {
      body: value2,
      channels: channels2,
    });

    const putted1Date = new Date(putted1.headers.get("last-modified")!);
    putted1Date.setUTCMilliseconds(
      Number(putted1.headers.get("last-modified-ms")!),
    );
    const putted2Date = new Date(putted2.headers.get("last-modified")!);
    putted2Date.setUTCMilliseconds(
      Number(putted2.headers.get("last-modified-ms")!),
    );

    expect(putted2Date.getTime()).toBeGreaterThan(putted1Date.getTime());

    const channels = [channels1[0]];
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
    });
    expect(response.status).toBe(200);
    const output = await response.text();
    const parts = output.split("\n");
    expect(parts.length).toBe(2);
    const objects = parts.map((p) => JSON.parse(p));
    for (const obj of objects) {
      expect(obj.allowed).toBeUndefined();
      expect(obj.tombstone).toBe(false);
      if (obj.name === name1) {
        expect(obj.value).toEqual(value1);
        expect(obj.channels.sort()).toEqual(channels1.sort());
        expect(obj.lastModified).toBe(putted1Date.getTime());
      } else if (obj.name === name2) {
        expect(obj.value).toEqual(value2);
        expect(obj.channels.sort()).toEqual(channels2.sort());
        expect(obj.lastModified).toBe(putted2Date.getTime());
      } else {
        throw new Error("Unexpected object");
      }
    }
  });

  it("discover with bad schema", async () => {
    const response = await solidFetch(baseUrl + "/discover?schema=alskdjflk");
    expect(response.status).toBe(422);
  });

  it("discover with schema", async () => {
    const channels = [randomString(), randomString()];
    for (let i = 9; i >= 0; i--) {
      await request(solidFetch, toUrl(randomString()), "PUT", {
        body: { index: i },
        channels,
      });
    }

    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
      schema: {
        // JSON Schema query
        properties: {
          value: {
            properties: {
              index: {
                type: "number",
                minimum: 3,
                maximum: 8,
              },
              "random👻otherfield": {
                enum: ["👻", "👽", "`,\\\n,dkjs🤘"],
              },
            },
          },
        },
      },
    });

    expect(response.ok).toBe(true);
    const output = await response.text();
    const parts = output.split("\n");
    expect(parts.length).toBe(6);
    let index = 3;
    const partsSortedByIndex = parts.sort(
      (a, b) => JSON.parse(a).value.index - JSON.parse(b).value.index,
    );
    for (const part of partsSortedByIndex) {
      expect(JSON.parse(part).value.index).toBe(index);
      index++;
    }
  });
});
