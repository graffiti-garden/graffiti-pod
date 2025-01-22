import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { Actor } from "./actor.decorator";
import { createServer } from "http";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import { solidLogin } from "../test/utils";
import { UnauthorizedException } from "@nestjs/common";

const port = 4000;

describe("Actor", () => {
  function getWebIdFactory(decorator: Function) {
    class Test {
      test(@decorator() actor: string | null) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Test, "test");
    return args[Object.keys(args)[0]].factory;
  }

  let actor: string;
  let authenticatedFetch: typeof fetch;

  beforeAll(async () => {
    const login = await solidLogin();
    authenticatedFetch = login.fetch;
    if (!login.webId) {
      throw "No webId in login object";
    }
    actor = login.webId;
  });

  it("plain fetch", async () => {
    const server = createServer(async (request, response) => {
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(Actor);
      const actor = await factory(null, ctx);
      expect(actor).toBeNull();
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
      const factory = getWebIdFactory(Actor);
      const webIdReceived = await factory(null, ctx);
      expect(webIdReceived).toEqual(actor);
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
      request.headers.authorization = request.headers.authorization?.slice(
        0,
        -1,
      );
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(Actor);
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
      request.headers.dpop = request.headers.dpop?.slice(0, -1);
      const ctx = new ExecutionContextHost([request, response]);
      const factory = getWebIdFactory(Actor);
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
