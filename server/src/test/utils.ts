import "dotenv/config";
import { Session } from "@inrupt/solid-client-authn-node";

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
