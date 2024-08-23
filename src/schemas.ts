import { JSONSchemaType } from "ajv";

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

export const GRAFFITI_OBJECT_SCHEMA: JSONSchemaType<{
  webId: string;
  name: string;
  channels: string[];
  value?: {};
  acl?: string[];
  tombstone: boolean;
  lastModified: string;
}> = {
  type: "object",
  properties: {
    webId: { type: "string" },
    name: { type: "string" },
    value: {
      type: "object",
      nullable: true,
    },
    channels: { type: "array", items: { type: "string" } },
    acl: { type: "array", nullable: true, items: { type: "string" } },
    tombstone: { type: "boolean" },
    lastModified: { type: "string" },
  },
  required: ["webId", "name", "channels", "tombstone", "lastModified"],
};
