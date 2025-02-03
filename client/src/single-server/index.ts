import type Ajv from "ajv-draft-04";
import type { Graffiti } from "@graffiti-garden/api";
import { GraffitiSingleServerCrud } from "./crud";
import { GraffitiSingleServerStreamers } from "./streamers";

export interface GraffitiSingleServerOptions {
  source: string;
}

export class GraffitiSingleServer
  implements
    Pick<
      Graffiti,
      | "put"
      | "get"
      | "patch"
      | "delete"
      | "discover"
      | "recoverOrphans"
      | "channelStats"
    >
{
  protected readonly crud: GraffitiSingleServerCrud;
  protected readonly streamers: GraffitiSingleServerStreamers;

  put: Graffiti["put"];
  get: Graffiti["get"];
  patch: Graffiti["patch"];
  delete: Graffiti["delete"];
  discover: Graffiti["discover"];
  recoverOrphans: Graffiti["recoverOrphans"];
  channelStats: Graffiti["channelStats"];

  constructor(options: GraffitiSingleServerOptions, ajv: Ajv) {
    this.crud = new GraffitiSingleServerCrud(options.source, ajv);
    this.streamers = new GraffitiSingleServerStreamers(options.source, ajv);

    this.put = this.crud.put.bind(this.crud);
    this.get = this.crud.get.bind(this.crud);
    this.patch = this.crud.patch.bind(this.crud);
    this.delete = this.crud.delete.bind(this.crud);
    this.discover = this.streamers.discover.bind(this.streamers);
    this.recoverOrphans = this.streamers.recoverOrphans.bind(this.streamers);
    this.channelStats = this.streamers.channelStats.bind(this.streamers);
  }
}
