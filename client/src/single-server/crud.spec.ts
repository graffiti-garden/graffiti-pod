import { graffitiCRUDTests } from "@graffiti-garden/api/tests";
import { GraffitiSingleServerCrud } from "./crud";
import * as secrets1 from "../../../.secrets1.json";
import * as secrets2 from "../../../.secrets2.json";
import Ajv from "ajv-draft-04";
import { solidLogin } from "../test-utils";

const ajv = new Ajv({ strict: false });

const session1 = solidLogin(secrets1);
const session2 = solidLogin(secrets2);

graffitiCRUDTests(
  () => new GraffitiSingleServerCrud("http://localhost:3000", ajv),
  () => session1,
  () => session2,
);
