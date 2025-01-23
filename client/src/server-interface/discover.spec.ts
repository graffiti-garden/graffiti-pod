import { graffitiDiscoverTests } from "@graffiti-garden/api/tests";
import { GraffitiFederatedCrud } from "./crud";
import { GraffitiFederatedDiscover } from "./discover";
import * as secrets1 from "../../../.secrets1.json";
import * as secrets2 from "../../../.secrets2.json";
import Ajv from "ajv-draft-04";
import { solidLogin } from "../test-utils";

const session1 = await solidLogin(secrets1);
const session2 = await solidLogin(secrets2);
const ajv = new Ajv({ strict: false });

const source = "http://localhost:3000";

graffitiDiscoverTests(
  () => {
    const crud = new GraffitiFederatedCrud(source, ajv);
    const discover = new GraffitiFederatedDiscover(source, ajv);
    return {
      put: crud.put.bind(crud),
      get: crud.get.bind(crud),
      patch: crud.patch.bind(crud),
      delete: crud.delete.bind(crud),
      discover: discover.discover.bind(discover),
    };
  },
  () => session1,
  () => session2,
);
