import * as secrets from "../.secrets.json";
import { Session } from "@inrupt/solid-client-authn-node";

export const homePod = "https://pod.graffiti.garden";

export async function solidLogin() {
  const session = new Session({ keepAlive: true });
  await session.login(secrets);
  if (!session.info.isLoggedIn || !session.info.webId) {
    throw new Error("Could not log in");
  }
  return {
    fetch: session.fetch,
    webId: session.info.webId,
  };
}

export function randomString(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomLocation(webId: string, graffitiPod = homePod) {
  return {
    name: randomString(),
    webId,
    graffitiPod,
  };
}

export function randomValue() {
  return {
    [randomString()]: randomString(),
  };
}
