import type { GraffitiSession } from "@graffiti-garden/api";

export interface GraffitiSessionOIDC extends GraffitiSession {
  fetch: typeof fetch;
}
