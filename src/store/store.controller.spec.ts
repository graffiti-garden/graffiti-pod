import { Test, TestingModule } from "@nestjs/testing";
import {
  NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import { randomString, solidLogin } from "../test/utils";
import { StoreModule } from "./store.module";
import { RootMongooseModule } from "../app.module";
import { encodeURIArray } from "../params/params.utils";
import { Operation } from "fast-json-patch";

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
      acl?: string[];
      ifModifiedSince?: string;
      range?: string;
    },
  ) {
    url += "?";
    const init: RequestInit = { method, headers: {} };
    if (options?.body) {
      init.headers!["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    if (options?.channels) {
      url += "channels=" + encodeURIArray(options.channels) + "&";
    }
    if (options?.acl) {
      url += "access-control-list=" + encodeURIArray(options.acl) + "&";
    }
    if (options?.schema) {
      url +=
        "schema=" + encodeURIComponent(JSON.stringify(options.schema)) + "&";
    }
    if (options?.ifModifiedSince) {
      init.headers!["If-Modified-Since"] = options.ifModifiedSince;
    }
    if (options?.range) {
      init.headers!["Range"] = options.range;
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
      encodeURIArray(channels),
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
      encodeURIArray(acl),
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
    expect(response.status).toBe(422);
  });

  it("patch channels and acl", async () => {
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", { body: {} });
    const response = await request(solidFetch, url, "PATCH", {
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

  it("query empty", async () => {
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels: [],
    });
    expect(response.status).toBe(204);
    const output = await response.text();
    expect(output.length).toBe(0);
  });

  it("query single", async () => {
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
    expect(output.acl).toBeNull();
    expect(output.tombstone).toBe(false);
  });

  it("query multiple", async () => {
    const value1 = { [randomString()]: randomString() + "alskdjfk\n\n\\n" };
    const value2 = { [randomString()]: randomString() + "\n😏" };
    const channels1 = [randomString(), randomString()];
    const channels2 = [randomString(), channels1[0]];
    const putted1 = await request(solidFetch, toUrl(randomString()), "PUT", {
      body: value1,
      channels: channels1,
    });
    const putted2 = await request(solidFetch, toUrl(randomString()), "PUT", {
      body: value2,
      channels: channels2,
    });

    expect(
      new Date(putted2.headers.get("last-modified")!).getTime(),
    ).toBeGreaterThan(
      new Date(putted1.headers.get("last-modified")!).getTime(),
    );

    const channels = [channels1[0]];
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("last-modified")).toBe(
      putted2.headers.get("last-modified"),
    );
    const output = await response.text();
    const parts = output.split("\n");
    expect(parts.length).toBe(2);
    const [first, second] = parts.map((p) => JSON.parse(p));
    expect(first.value).toEqual(value2);
    expect(first.channels.sort()).toEqual(channels2.sort());
    expect(first.acl).toBeNull();
    expect(first.tombstone).toBe(false);
    expect(second.value).toEqual(value1);
    expect(second.channels.sort()).toEqual(channels1.sort());
    expect(second.acl).toBeNull();
    expect(second.tombstone).toBe(false);
  });

  it("query empty modified since", async () => {
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      ifModifiedSince: new Date().toISOString(),
    });
    expect(response.status).toBe(304);
  });

  it("query modified since", async () => {
    const channels = [randomString(), randomString()];
    const url1 = toUrl(randomString());
    await request(solidFetch, url1, "PUT", { body: {}, channels });
    const gotten1 = await fetch(url1);
    const lastModified1 = new Date(gotten1.headers.get("last-modified") ?? 0);

    const url2 = toUrl(randomString());
    const value = { [randomString()]: randomString() };
    await request(solidFetch, url2, "PUT", { body: value, channels });
    const gotten2 = await fetch(url2);
    const lastModified2 = new Date(gotten2.headers.get("last-modified") ?? 0);

    expect(lastModified1.getTime()).toBeLessThan(lastModified2.getTime());

    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
      ifModifiedSince: lastModified1.toISOString(),
    });
    expect(response.headers.get("last-modified")).toBe(
      lastModified2.toISOString(),
    );
    expect(response.status).toBe(200);
    // Output only contains the last value
    const output = await response.json();
    expect(output.value).toEqual(value);
  });

  it("bad ifModifiedSince", async () => {
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      ifModifiedSince: "alskdjflk",
    });
    expect(response.status).toBe(400);
  });

  it("query with skip", async () => {
    const channels = [randomString(), randomString()];
    for (let i = 9; i >= 0; i--) {
      await request(solidFetch, toUrl(randomString()), "PUT", {
        body: { index: i },
        channels,
      });
    }
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
      range: "=4-",
    });
    expect(response.status).toBe(200);
    const output = await response.text();
    const parts = output.split("\n");
    expect(parts.length).toBe(6);
    let index = 4;
    for (const part of parts) {
      expect(JSON.parse(part).value.index).toBe(index);
      index++;
    }
  });

  it("query with limit", async () => {
    const channels = [randomString(), randomString()];
    for (let i = 9; i >= 0; i--) {
      await request(solidFetch, toUrl(randomString()), "PUT", {
        body: { index: i },
        channels,
      });
    }
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
      range: "=-4",
    });
    expect(response.status).toBe(200);
    const output = await response.text();
    const parts = output.split("\n");
    expect(parts.length).toBe(5);
    let index = 0;
    for (const part of parts) {
      expect(JSON.parse(part).value.index).toBe(index);
      index++;
    }
  });

  it("query with skip and limit", async () => {
    const channels = [randomString(), randomString()];
    for (let i = 9; i >= 0; i--) {
      await request(solidFetch, toUrl(randomString()), "PUT", {
        body: { index: i },
        channels,
      });
    }
    const response = await request(solidFetch, baseUrl + "/discover", "GET", {
      channels,
      range: "=2-7",
    });

    expect(response.status).toBe(200);
    const output = await response.text();
    const parts = output.split("\n");
    expect(parts.length).toBe(6);
    let index = 2;
    for (const part of parts) {
      expect(JSON.parse(part).value.index).toBe(index);
      index++;
    }
  });

  it("query with bad schema", async () => {
    const response = await solidFetch(baseUrl + "/discover?schema=alskdjflk");
    expect(response.status).toBe(400);
  });

  it("query with schema", async () => {
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
    for (const part of parts) {
      expect(JSON.parse(part).value.index).toBe(index);
      index++;
    }
  });

  it("list channels", async () => {
    const channels = [randomString(), randomString()];
    const url = toUrl(randomString());
    await request(solidFetch, url, "PUT", {
      body: {},
      channels,
    });

    const response = await request(
      solidFetch,
      baseUrl + "/list-channels",
      "GET",
    );
    expect(response.ok).toBe(true);
    const results = (await response.text())
      .split("\n")
      .map((r) => JSON.parse(r));
    const relevant = results.filter((r) => channels.includes(r.channel));
    expect(relevant.length).toBeLessThan(results.length);
    expect(relevant.length).toBe(channels.length);
    expect(relevant.map((r) => r.count)).toEqual(channels.map(() => 1));
    expect(relevant.map((r) => r.channel).sort()).toEqual(channels.sort());
    expect(relevant[0].lastModified).toEqual(relevant[1].lastModified);

    const now = new Date();

    await request(solidFetch, toUrl(randomString()), "PUT", {
      body: {},
      channels: [channels[0]],
    });

    const response2 = await request(
      solidFetch,
      baseUrl + "/list-channels",
      "GET",
      {
        ifModifiedSince: now.toISOString(),
      },
    );
    expect(response2.ok).toBe(true);
    const results2 = await response2.json();
    expect(results2.channel).toEqual(channels[0]);
    expect(results2.count).toEqual(2);
    expect(new Date(results2.lastModified).getTime()).toBeGreaterThan(
      new Date(relevant[0].lastModified).getTime(),
    );
  });

  it("list orphans", async () => {
    const name = randomString();
    await request(solidFetch, toUrl(name), "PUT", { body: {} });
    const response = await request(
      solidFetch,
      baseUrl + "/list-orphans",
      "GET",
    );
    expect(response.ok).toBe(true);
    const results = (await response.text())
      .split("\n")
      .map((r) => JSON.parse(r));
    const relevant = results.filter((r) => r.name === name);
    expect(relevant.length).toBe(1);
    expect(relevant.length).toBeLessThan(results.length);
    expect(relevant[0].lastModified).toBeDefined();
    expect(relevant[0].tombstone).toBe(false);

    // Add channels to the orphan
    const channels = [randomString(), randomString()];
    await request(solidFetch, toUrl(name), "PUT", {
      body: {},
      channels,
    });
    const response2 = await request(
      solidFetch,
      baseUrl + "/list-orphans",
      "GET",
      {
        ifModifiedSince: new Date(
          new Date(relevant[0].lastModified).getTime() + 1,
        ).toISOString(),
      },
    );

    expect(response2.ok).toBe(true);
    const results2 = await response2.json();
    expect(results2.name).toBe(name);
    expect(new Date(results2.lastModified).getTime()).toBeGreaterThan(
      new Date(relevant[0].lastModified).getTime(),
    );
    expect(results2.tombstone).toBe(true);
  });
});
