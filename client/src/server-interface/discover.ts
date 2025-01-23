import { Graffiti, GraffitiErrorSchemaMismatch } from "@graffiti-garden/api";
import type { GraffitiObjectBase, JSONSchema4 } from "@graffiti-garden/api";
import Ajv, { type ValidateFunction, type JSONSchemaType } from "ajv-draft-04";
import { attemptAjvCompile } from "@graffiti-garden/implementation-pouchdb";
import { parseJSONLinesResponse } from "./decode-response";
import { encodeQueryParams } from "./encode-request";
import type { GraffitiSessionOIDC } from "../types";

export const GRAFFITI_OBJECT_SCHEMA: JSONSchemaType<GraffitiObjectBase> = {
  type: "object",
  properties: {
    actor: { type: "string" },
    name: { type: "string" },
    source: { type: "string" },
    value: { type: "object" },
    channels: { type: "array", items: { type: "string" } },
    allowed: { type: "array", nullable: true, items: { type: "string" } },
    tombstone: { type: "boolean" },
    lastModified: { type: "number" },
  },
  required: [
    "actor",
    "name",
    "source",
    "channels",
    "tombstone",
    "lastModified",
    "value",
  ],
};

export class GraffitiFederatedDiscover implements Pick<Graffiti, "discover"> {
  ajv: Ajv;
  source: string;
  validateGraffitiObject: ValidateFunction<GraffitiObjectBase>;

  constructor(source: string, ajv: Ajv) {
    this.source = source;
    this.ajv = ajv;
    this.validateGraffitiObject = this.ajv.compile(GRAFFITI_OBJECT_SCHEMA);
  }

  async *discover<Schema extends JSONSchema4>(
    channels: string[],
    schema: Schema,
    session?: GraffitiSessionOIDC,
  ) {
    const validate = attemptAjvCompile(this.ajv, schema);

    const url = encodeQueryParams(`${this.source}/discover`, {
      channels,
      schema,
    });
    const response = await (session?.fetch ?? fetch)(url);

    const iterator = parseJSONLinesResponse(response, this.source, (object) => {
      if (!this.validateGraffitiObject(object)) {
        throw new Error("Source returned a non-Graffiti object");
      }
      if (object.source !== this.source) {
        throw new Error(
          "Source returned an object claiming to be from another source",
        );
      }
      if (!validate(object)) {
        throw new GraffitiErrorSchemaMismatch();
      }
      return object;
    });

    for await (const object of iterator) {
      yield object;
    }
    return { tombstoneRetention: 0 };
  }
}
