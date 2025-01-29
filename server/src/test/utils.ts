import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";
import type { FastifyReply } from "fastify";
import type { GraffitiObjectBase } from "@graffiti-garden/api";
import { randomBase64 } from "@graffiti-garden/implementation-local/utilities";

const clientId = process.env.SOLID_CLIENT_ID;
const clientSecret = process.env.SOLID_CLIENT_SECRET;
const oidcIssuer = process.env.SOLID_OIDC_ISSUER;
if (!clientId || !clientSecret || !oidcIssuer) {
  throw "You haven't defined a solid client id, client secret or oidc issuer! See the Readme for more information.";
}

export async function solidLogin() {
  // Login to Solid
  const session = new Session();
  await session.login({
    oidcIssuer,
    clientId,
    clientSecret,
  });
  return {
    fetch: session.fetch,
    webId: session.info.webId,
  };
}

export const randomString = randomBase64;

export function randomGraffitiObject(): GraffitiObjectBase {
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

export function responseMock() {
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
