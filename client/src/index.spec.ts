import { describe } from "vitest";
import {
  graffitiDiscoverTests,
  graffitiCRUDTests,
  graffitiLocationTests,
  graffitiSynchronizeTests,
} from "@graffiti-garden/api/tests";
import { GraffitiFederated } from "./index";
import * as secrets1 from "../../.secrets1.json";
import * as secrets2 from "../../.secrets2.json";
import { solidLogin } from "./test-utils";
import { randomBase64 } from "@graffiti-garden/implementation-local/utilities";

const session1 = await solidLogin(secrets1);
const session2 = await solidLogin(secrets2);

const source = "http://localhost:3000";
const options = { remote: { source } };

describe("Remote sessions", () => {
  graffitiDiscoverTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
  graffitiCRUDTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
  graffitiLocationTests(() => new GraffitiFederated(options));
  graffitiSynchronizeTests(
    () => new GraffitiFederated(options),
    () => session1,
    () => session2,
  );
});

// Local tests as well
describe("Local sessions", () => {
  graffitiDiscoverTests(
    () => new GraffitiFederated(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiCRUDTests(
    () => new GraffitiFederated(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
  graffitiSynchronizeTests(
    () => new GraffitiFederated(options),
    () => ({ actor: "local" + randomBase64() }),
    () => ({ actor: "local" + randomBase64() }),
  );
});
