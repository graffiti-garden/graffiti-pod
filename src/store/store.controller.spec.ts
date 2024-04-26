import { Test, TestingModule } from "@nestjs/testing";
import {
  NestFastifyApplication,
  FastifyAdapter,
} from "@nestjs/platform-fastify";
import { randomString, solidLogin } from "../test/utils";
import { StoreModule } from "./store.module";
import { RootMongooseModule } from "../app.module";
import { encodeHeaderArray, decodeHeaderArray } from "../params/params.utils";

describe("StoreController", () => {
  let app: NestFastifyApplication;
  let solidFetch: typeof fetch;
  let webId: string;
  const port = 3000;

  function toUrl(name: string, webId_: string = webId) {
    return `http://localhost:${port}/${encodeURIComponent(webId_)}/${encodeURIComponent(name)}`;
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
  });

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
    const body = { [randomString()]: randomString() };
    const channels = [randomString(), "://,🎨", randomString()];
    const responsePut = await request(solidFetch, url, "PUT", {
      body,
      channels,
    });
    expect(responsePut.status).toBe(201);

    // Fetch authenticated
    const responseGetAuth = await solidFetch(url);
    expect(responseGetAuth.status).toBe(200);
    expect(responseGetAuth.headers.get("access-control-list")).toBeNull();
    expect(responseGetAuth.headers.get("channels")).toBe(
      encodeHeaderArray(channels),
    );
    await expect(responseGetAuth.json()).resolves.toEqual(body);

    // Fetch unauthenticated
    const responseGetUnauth = await fetch(url);
    expect(responseGetUnauth.status).toBe(200);
    await expect(responseGetUnauth.json()).resolves.toEqual(body);
    expect(responseGetUnauth.headers.get("access-control-list")).toBeNull();
    expect(responseGetUnauth.headers.get("channels")).toBeNull();
  });
});
