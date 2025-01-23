import type {
  Graffiti,
  JSONSchema4,
  GraffitiLocation,
  GraffitiPutObject,
  GraffitiPatch,
} from "@graffiti-garden/api";
import { GraffitiErrorSchemaMismatch } from "@graffiti-garden/api";
import type { GraffitiSessionOIDC } from "../types";
import {
  unpackLocationOrUri,
  attemptAjvCompile,
  randomBase64,
  locationToUri,
} from "@graffiti-garden/implementation-pouchdb";
import { parseGraffitiObjectResponse } from "./decode-response";
import { encodeJSONBody, encodeQueryParams } from "./encode-request";
import type Ajv from "ajv-draft-04";

export class GraffitiFederatedCrud
  implements Pick<Graffiti, "get" | "put" | "patch" | "delete">
{
  ajv: Ajv;
  source: string;
  constructor(source: string, ajv: Ajv) {
    this.source = source;
    this.ajv = ajv;
  }

  async get<Schema extends JSONSchema4>(
    locationOrUri: GraffitiLocation | string,
    schema: Schema,
    session?: GraffitiSessionOIDC,
  ) {
    const { location, uri } = unpackLocationOrUri(locationOrUri);
    const getUrl = encodeQueryParams(uri, { schema });
    const response = await (session?.fetch ?? fetch)(getUrl);
    const object = await parseGraffitiObjectResponse(response, location, true);
    const validate = attemptAjvCompile(this.ajv, schema);
    if (!validate(object)) {
      throw new GraffitiErrorSchemaMismatch(
        "The fetched object does not match the provided schema.",
      );
    }
    return object;
  }

  async put<Schema extends JSONSchema4>(
    object: GraffitiPutObject<Schema>,
    session: GraffitiSessionOIDC,
  ) {
    const name = object.name ?? randomBase64();
    const source = object.source ?? this.source;
    const actor = object.actor ?? session.actor;
    const location: GraffitiLocation = { name, source, actor };
    const url = locationToUri(location);

    const requestInit: RequestInit = { method: "PUT" };
    encodeJSONBody(requestInit, object.value);
    const putUrl = encodeQueryParams(url, {
      channels: object.channels,
      allowed: object.allowed,
    });
    const response = await session.fetch(putUrl, requestInit);
    return await parseGraffitiObjectResponse(response, location);
  }

  async patch(
    patch: GraffitiPatch,
    locationOrUri: GraffitiLocation | string,
    session: GraffitiSessionOIDC,
  ) {
    const { location, uri } = unpackLocationOrUri(locationOrUri);
    const requestInit: RequestInit = { method: "PATCH" };
    if (patch.value) {
      encodeJSONBody(requestInit, patch.value);
    }
    const patchUrl = encodeQueryParams(uri, {
      channels: patch.channels?.map((p) => JSON.stringify(p)),
      allowed: patch.allowed?.map((p) => JSON.stringify(p)),
    });
    const response = await session.fetch(patchUrl, requestInit);
    return await parseGraffitiObjectResponse(response, location);
  }

  async delete(
    locationOrUri: GraffitiLocation | string,
    session: GraffitiSessionOIDC,
  ) {
    const { location, uri } = unpackLocationOrUri(locationOrUri);
    const response = await session.fetch(uri, { method: "DELETE" });
    return await parseGraffitiObjectResponse(response, location);
  }
}
