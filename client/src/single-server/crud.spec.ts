import { graffitiCRUDTests } from "@graffiti-garden/api/tests";
import { GraffitiSinglePodCrud } from "./crud";
import * as secrets1 from "../../../.secrets1.json";
import * as secrets2 from "../../../.secrets2.json";
import Ajv from "ajv-draft-04";
import { solidLogin } from "../test-utils";

const session1 = await solidLogin(secrets1);
const session2 = await solidLogin(secrets2);
const ajv = new Ajv({ strict: false });

graffitiCRUDTests(
  () => new GraffitiSinglePodCrud("http://localhost:3000", ajv),
  () => session1,
  () => session2,
);
