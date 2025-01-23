import { graffitiCRUDTests } from "@graffiti-garden/api/tests";
import { GraffitiFederatedCrud, type GraffitiSessionOIDC } from "./crud";
import * as secrets1 from "../../../.secrets1.json";
import * as secrets2 from "../../../.secrets2.json";
import { Session } from "@inrupt/solid-client-authn-node";
import Ajv from "ajv-draft-04";

async function solidLogin(secrets: any): Promise<GraffitiSessionOIDC> {
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

const session1 = await solidLogin(secrets1);
const session2 = await solidLogin(secrets2);
const ajv = new Ajv({ strict: false });

graffitiCRUDTests(
  () => new GraffitiFederatedCrud("http://localhost:3000", ajv),
  () => session1,
  () => session2,
);
