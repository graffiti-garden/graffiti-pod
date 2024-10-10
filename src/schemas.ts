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

export const GRAFFITI_OBJECT_SCHEMA: JSONSchemaType<{
  webId: string;
  name: string;
  channels: string[];
  value: {};
  acl?: string[];
  tombstone: boolean;
  lastModified: string;
}> = {
  type: "object",
  properties: {
    webId: { type: "string" },
    name: { type: "string" },
    value: { type: "object" },
    channels: { type: "array", items: { type: "string" } },
    acl: { type: "array", nullable: true, items: { type: "string" } },
    tombstone: { type: "boolean" },
    lastModified: { type: "string" },
  },
  required: ["webId", "name", "channels", "tombstone", "lastModified", "value"],
};

export const POD_ANNOUNCE_SCHEMA = {
  properties: {
    value: {
      required: ["podAnnounce"],
      properties: {
        podAnnounce: {
          type: "string",
        },
      },
    },
  },
} satisfies JSONSchema4;

export const USER_SETTINGS_SCHEMA = {
  type: "object",
  required: ["value"],
  properties: {
    value: {
      type: "object",
      required: ["podDelegation"],
      properties: {
        podDelegation: {
          type: "array",
          items: {
            type: "object",
            required: ["pod", "schema"],
            properties: {
              pod: { type: "string" },
              schema: { type: "object" },
            },
          },
        },
      },
    },
  },
} as const satisfies JSONSchema4;
