import type Ajv from "ajv-draft-04";
import type { Graffiti } from "@graffiti-garden/api";
import { GraffitiSinglePodCrud } from "./crud";
import { GraffitiSinglePodDiscover } from "./discover";

export interface GraffitiSinglePodBaseOptions {
  source: string;
}

export class GraffitiSinglePodBase
  implements
    Pick<
      Graffiti,
      | "put"
      | "get"
      | "patch"
      | "delete"
      | "discover"
      | "listOrphans"
      | "listChannels"
    >
{
  protected readonly crud: GraffitiSinglePodCrud;
  protected readonly discoverClass: GraffitiSinglePodDiscover;

  put: Graffiti["put"];
  get: Graffiti["get"];
  patch: Graffiti["patch"];
  delete: Graffiti["delete"];
  discover: Graffiti["discover"];

  constructor(options: GraffitiSinglePodBaseOptions, ajv: Ajv) {
    this.crud = new GraffitiSinglePodCrud(options.source, ajv);
    this.discoverClass = new GraffitiSinglePodDiscover(options.source, ajv);

    this.put = this.crud.put.bind(this.crud);
    this.get = this.crud.get.bind(this.crud);
    this.patch = this.crud.patch.bind(this.crud);
    this.delete = this.crud.delete.bind(this.crud);
    this.discover = this.discoverClass.discover.bind(this.discoverClass);
  }

  listChannels: Graffiti["listChannels"] = (...args) => {
    // TODO
    return (async function* () {})();
  };

  listOrphans: Graffiti["listOrphans"] = (...args) => {
    // TODO
    return (async function* () {})();
  };
}
