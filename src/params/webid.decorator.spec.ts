import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { WebId } from "./webid.decorator";
import { createServer } from "http";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";

const port = 4000;

const clientId = process.env.SOLID_CLIENT_ID;
const clientSecret = process.env.SOLID_CLIENT_SECRET;
const oidcIssuer = process.env.SOLID_OIDC_ISSUER;
if (!clientId || !clientSecret || !oidcIssuer) {
  throw "You haven't defined a solid client id, client secret or oidc issuer! See the Readme for more information.";
}

describe("WebId", () => {
  function getWebIdFactory(decorator: Function) {
    class Test {
      test(@decorator() webId: string | null) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, "test");
    return args[Object.keys(args)[0]].factory;
  }

  let webId: string;
  let authenticatedFetch: typeof fetch;

  beforeAll(async () => {
    // Login to Solid
    const session = new Session();
    await session.login({
      oidcIssuer,
      clientId,
      clientSecret,
    });
    authenticatedFetch = session.fetch;
    webId = session.info.webId;
  });

  it("plain fetch", async () => {
    let requestReceived = false;
    const server = createServer(async (request, response) => {
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      const webId = await factory(null, ctx);
      expect(webId).toBeNull();
      requestReceived = true;
      response.end();
    });
    server.listen(port);

    await fetch(`http://localhost:${port}/alksdjf?alskdfj=alksdjf`);
    expect(requestReceived).toBe(true);
    server.close();
  });

  it("authenticated fetch", async () => {
    let requestReceived = false;
    const server = createServer(async (request, response) => {
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      const webIdReceived = await factory(null, ctx);
      expect(webIdReceived).toEqual(webId);
      requestReceived = true;
      response.end();
    });
    server.listen(port);

    const result = await authenticatedFetch(
      `http://localhost:${port}/alksdjf?alskdfj=alksdjf#1234`,
    );
    expect(requestReceived).toBe(true);
    server.close();
  });

  test("invalid authorization", async () => {
    let requestReceived = false;
    const server = createServer(async (request, response) => {
      // Remove the last charachter of the authorization header
      request.headers.authorization = request.headers.authorization.slice(
        0,
        -1,
      );
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      await expect(factory(null, ctx)).rejects.toThrow();
      requestReceived = true;
      response.end();
    });
    server.listen(port);

    await authenticatedFetch(`http://localhost:${port}`);
    expect(requestReceived).toBe(true);
    server.close();
  });

  test("invalid dpop", async () => {
    let requestReceived = false;
    const server = createServer(async (request, response) => {
      // Remove the last charachter of the dpop header
      request.headers.dpop = request.headers.dpop.slice(0, -1);
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      await expect(factory(null, ctx)).rejects.toThrow();
      requestReceived = true;
      response.end();
    });
    server.listen(port);

    await authenticatedFetch(`http://localhost:${port}`);
    expect(requestReceived).toBe(true);
    server.close();
  });
});
