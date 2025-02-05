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
import { describe } from "vitest";

const session1 = await solidLogin(secrets1);
const session2 = await solidLogin(secrets2);
const ajv = new Ajv({ strict: false });

const source = "http://localhost:3000";

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
