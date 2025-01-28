import { type JSONSchemaType } from "ajv";
import type { JSONSchema4 } from "json-schema";

export const ORPHAN_RESULT_SCHEMA: JSONSchemaType<{
  name: string;
  tombstone: boolean;
  lastModified: string;
}> = {
  type: "object",
  properties: {
    name: { type: "string" },
    tombstone: { type: "boolean" },
    lastModified: { type: "string" },
  },
  required: ["name", "tombstone", "lastModified"],
};

export const CHANNEL_RESULT_SCHEMA: JSONSchemaType<{
  channel: string;
  count: number;
  lastModified: string;
}> = {
  type: "object",
  properties: {
    channel: { type: "string" },
    count: { type: "number" },
    lastModified: { type: "string" },
  },
  required: ["channel", "count", "lastModified"],
};
