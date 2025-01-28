import { Graffiti } from "@graffiti-garden/api";
import Ajv from "ajv-draft-04";
import {
  GraffitiSynchronize,
  GraffitiPouchDBBase,
  type GraffitiPouchDBOptions,
  locationToUri,
  uriToLocation,
} from "@graffiti-garden/implementation-pouchdb";
import {
  GraffitiSolidOIDCInterface,
  type GraffitiSolidOIDCInterfaceOptions,
} from "@graffiti-garden/solid-oidc-interface";
import {
  GraffitiSinglePodBase,
  type GraffitiSinglePodBaseOptions,
} from "./server-interface/single-pod-base";
import { GraffitiRemoteAndLocal } from "./remote-and-local";

export class GraffitiFederatedPods extends Graffiti {
  locationToUri = locationToUri;
  uriToLocation = uriToLocation;

  put: Graffiti["put"];
  get: Graffiti["get"];
  patch: Graffiti["patch"];
  delete: Graffiti["delete"];
  discover: Graffiti["discover"];
  synchronize: Graffiti["synchronize"];
  listChannels: Graffiti["listChannels"];
  listOrphans: Graffiti["listOrphans"];
  login: Graffiti["login"];
  logout: Graffiti["logout"];
  sessionEvents: Graffiti["sessionEvents"];

  /**
   * Create a new Graffiti client that can interact with a federated set of pods.
   */
  constructor(options?: {
    local?: GraffitiPouchDBOptions;
    remote?: GraffitiSinglePodBaseOptions;
    session?: GraffitiSolidOIDCInterfaceOptions;
  }) {
    super();

    const sessionManager = new GraffitiSolidOIDCInterface(options?.session);
    this.login = sessionManager.login.bind(sessionManager);
    this.logout = sessionManager.logout.bind(sessionManager);
    this.sessionEvents = sessionManager.sessionEvents;

    const ajv = new Ajv({ strict: false });
    const graffitiLocal = new GraffitiPouchDBBase(options?.local, ajv);
    const graffitiRemote = new GraffitiSinglePodBase(
      options?.remote ?? {
        source: "https://pod.graffiti.garden",
      },
      ajv,
    );
    const graffitiRemoteAndLocal = new GraffitiRemoteAndLocal(
      graffitiLocal,
      graffitiRemote,
    );

    const graffitiSynchronized = new GraffitiSynchronize(
      graffitiRemoteAndLocal,
      ajv,
    );

    this.put = graffitiSynchronized.put;
    this.get = graffitiSynchronized.get;
    this.patch = graffitiSynchronized.patch;
    this.delete = graffitiSynchronized.delete;
    this.discover = graffitiSynchronized.discover;
    this.synchronize = graffitiSynchronized.synchronize;
    this.listChannels = graffitiRemoteAndLocal.listChannels;
    this.listOrphans = graffitiRemoteAndLocal.listOrphans;
  }
}
