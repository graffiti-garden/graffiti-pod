import { Session } from "@inrupt/solid-client-authn-node";
import type { GraffitiSessionOIDC } from "./types";

export async function solidLogin(secrets: any): Promise<GraffitiSessionOIDC> {
  const session = new Session({ keepAlive: true });
  await session.login(secrets);
  if (!session.info.isLoggedIn || !session.info.webId) {
    throw new Error("Could not log in");
  }
  return {
    fetch: session.fetch,
    actor: session.info.webId,
  };
}
