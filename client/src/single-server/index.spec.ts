import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiOrphanTests,
  graffitiChannelStatsTests,
} from "@graffiti-garden/api/tests";
import { GraffitiSingleServer } from "./index";
import * as secrets1 from "../../../.secrets1.json";
import * as secrets2 from "../../../.secrets2.json";
import Ajv from "ajv-draft-04";
import { solidLogin } from "../test-utils";

const ajv = new Ajv({ strict: false });

const source = "http://localhost:3000";

const session1 = solidLogin(secrets1);
const session2 = solidLogin(secrets2);

graffitiDiscoverTests(
  () => new GraffitiSingleServer({ source }, ajv),
  () => session1,
  () => session2,
);
graffitiCRUDTests(
  () => new GraffitiSingleServer({ source }, ajv),
  () => session1,
  () => session2,
);
graffitiOrphanTests(
  () => new GraffitiSingleServer({ source }, ajv),
  () => session1,
  () => session2,
);
graffitiChannelStatsTests(
  () => new GraffitiSingleServer({ source }, ajv),
  () => session1,
  () => session2,
);
