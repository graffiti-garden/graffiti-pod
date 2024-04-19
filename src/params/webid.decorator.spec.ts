import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { WebId } from "./webid.decorator";
import { createServer } from "http";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { solidLogin } from "../test/utils";
import { UnauthorizedException } from "@nestjs/common";

const port = 4000;

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
    const login = await solidLogin();
    authenticatedFetch = login.fetch;
    webId = login.webId;
  });

  it("plain fetch", async () => {
    const server = createServer(async (request, response) => {
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      const webId = await factory(null, ctx);
      expect(webId).toBeNull();
      response.end();
    });
    server.listen(port);

    await fetch(`http://localhost:${port}/alksdjf?alskdfj=alksdjf`);
    server.close();
    expect.assertions(1);
  });

  it("authenticated fetch", async () => {
    const server = createServer(async (request, response) => {
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      const webIdReceived = await factory(null, ctx);
      expect(webIdReceived).toEqual(webId);
      response.end();
    });
    server.listen(port);

    await authenticatedFetch(
      `http://localhost:${port}/alksdjf?alskdfj=alksdjf#1234`,
    );
    server.close();
    expect.assertions(1);
  });

  test("invalid authorization", async () => {
    const server = createServer(async (request, response) => {
      // Remove the last charachter of the authorization header
      request.headers.authorization = request.headers.authorization.slice(
        0,
        -1,
      );
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      try {
        await factory(null, ctx);
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
      }
      response.end();
    });
    server.listen(port);

    await authenticatedFetch(`http://localhost:${port}`);
    server.close();
    expect.assertions(1);
  });

  test("invalid dpop", async () => {
    const server = createServer(async (request, response) => {
      // Remove the last charachter of the dpop header
      request.headers.dpop = request.headers.dpop.slice(0, -1);
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(WebId);
      try {
        await factory(null, ctx);
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
      }
      response.end();
    });
    server.listen(port);

    await authenticatedFetch(`http://localhost:${port}`);
    server.close();
    expect.assertions(1);
  });
});
