import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";
import { GraffitiObject } from "../schemas/object.schema";
import { FastifyReply } from "fastify";
import { randomBytes } from "@noble/hashes/utils";
import { bytesToHex } from "@noble/curves/abstract/utils";

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

export function randomString(numBytes = 16) {
  return bytesToHex(randomBytes(numBytes));
}

export function randomGraffitiObject() {
  const go = new GraffitiObject();
  go.webId = randomString();
  go.name = randomString();
  go.value = { [randomString()]: randomString() };
  go.channels = [];
  return go;
}

export function responseMock() {
  const headers = new Map<string, string>();
  return {
    header(name: string, value: string) {
      headers.set(name, value);
    },
    getHeader(name: string) {
      return headers.get(name);
    },
  } as FastifyReply;
}
