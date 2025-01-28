import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
} from "@graffiti-garden/api/tests";
import { GraffitiSinglePodBase } from "./single-pod-base";
import * as secrets1 from "../../../.secrets1.json";
import * as secrets2 from "../../../.secrets2.json";
import Ajv from "ajv-draft-04";
import { solidLogin } from "../test-utils";

const session1 = await solidLogin(secrets1);
const session2 = await solidLogin(secrets2);
const ajv = new Ajv({ strict: false });

const source = "http://localhost:3000";

graffitiDiscoverTests(
  () => new GraffitiSinglePodBase({ source }, ajv),
  () => session1,
  () => session2,
);
graffitiCRUDTests(
  () => new GraffitiSinglePodBase({ source }, ajv),
  () => session1,
  () => session2,
);
