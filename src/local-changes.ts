import { Repeater } from "@repeaterjs/repeater";
import {
  GraffitiLocalObject,
  GraffitiLocation,
  GraffitiObject,
  GraffitiPatch,
} from "./types";
import { applyPatch } from "fast-json-patch";
import { type JSONSchema4 } from "json-schema";
import Ajv from "ajv";

type LocalChangeEvent = CustomEvent<{
  oldObject: GraffitiObject;
  newObject?: GraffitiObject;
}>;

export default class LocalChanges {
  readonly changes = new EventTarget();
  private ajv = new Ajv({
    strictTypes: false,
  });

  matchObject(
    object: GraffitiObject,
    options: {
      channels: string[];
      validate?: (object: GraffitiObject) => boolean;
      ifModifiedSince?: Date;
    },
  ): boolean {
    return (
      (!options.ifModifiedSince ||
        object.lastModified >= options.ifModifiedSince) &&
      object.channels.some((channel) => options.channels.includes(channel)) &&
      (!options.validate || options.validate(object))
    );
  }

  private dispatchChanges(
    oldObject: GraffitiObject,
    newObject?: GraffitiObject,
  ) {
    this.changes.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          oldObject,
          newObject,
        },
      }),
    );
  }

  put(newLocalObject: GraffitiLocalObject, oldObject: GraffitiObject): void {
    const newObject: GraffitiObject = {
      ...oldObject,
      ...newLocalObject,
      tombstone: false,
    };
    this.dispatchChanges(oldObject, newObject);
  }

  patch(patch: GraffitiPatch, oldObject: GraffitiObject): void {
    const newObject: GraffitiObject = { ...oldObject, tombstone: false };
    for (const prop of ["value", "channels", "acl"] as const) {
      const ops = patch[prop];
      if (!ops || !ops.length) continue;
      newObject[prop] = applyPatch(
        newObject[prop],
        ops,
        false,
        false,
      ).newDocument;
    }
    this.dispatchChanges(oldObject, newObject);
  }

  delete(oldObject: GraffitiObject): void {
    this.dispatchChanges(oldObject);
  }

  async *discover(
    channels: string[],
    options?: { schema?: JSONSchema4; ifModifiedSince?: Date },
  ): AsyncGenerator<GraffitiObject, void, void> {
    const validate = options?.schema
      ? this.ajv.compile(options.schema)
      : undefined;
    const matchOptions = {
      validate,
      ifModifiedSince: options?.ifModifiedSince,
      channels,
    };
    const repeater = new Repeater<GraffitiObject>(async (push, stop) => {
      const callback = (event: LocalChangeEvent) => {
        const { oldObject, newObject } = event.detail;

        if (newObject && this.matchObject(newObject, matchOptions)) {
          push(newObject);
        } else if (this.matchObject(oldObject, matchOptions)) {
          push(oldObject);
        }
      };

      this.changes.addEventListener("change", callback as EventListener);
      await stop;
      this.changes.removeEventListener("change", callback as EventListener);
    });

    for await (const object of repeater) {
      yield object;
    }
  }
}
