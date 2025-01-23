import { Repeater } from "@repeaterjs/repeater";
import type {
  GraffitiLocalObjectBase,
  GraffitiObjectBase,
  GraffitiPatch,
  GraffitiObject,
} from "./types";
import { applyPatch } from "fast-json-patch";
import type { JSONSchema4 } from "json-schema";
import Ajv from "ajv";

type LocalChangeEvent = CustomEvent<{
  oldObject: GraffitiObjectBase;
  newObject?: GraffitiObjectBase;
}>;

export default class LocalChanges {
  readonly changes = new EventTarget();

  constructor(
    private ajv: Ajv = new Ajv({
      strictTypes: false,
    }),
  ) {}

  matchObject(
    object: GraffitiObjectBase,
    options: {
      channels: string[];
      ifModifiedSince?: Date;
    },
  ): boolean {
    return (
      (!options.ifModifiedSince ||
        object.lastModified >= options.ifModifiedSince) &&
      object.channels.some((channel) => options.channels.includes(channel))
    );
  }

  private dispatchChanges(
    oldObject: GraffitiObjectBase,
    newObject?: GraffitiObjectBase,
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

  put(
    newLocalObject: GraffitiLocalObjectBase,
    oldObject: GraffitiObjectBase,
  ): void {
    const newObject: GraffitiObjectBase = {
      ...oldObject,
      ...newLocalObject,
      tombstone: false,
    };
    this.dispatchChanges(oldObject, newObject);
  }

  patch(patch: GraffitiPatch, oldObject: GraffitiObjectBase): void {
    const newObject: GraffitiObjectBase = { ...oldObject, tombstone: false };
    for (const prop of ["value", "channels", "acl"] as const) {
      const ops = patch[prop];
      if (!ops || !ops.length) continue;
      //@ts-ignore
      newObject[prop] = applyPatch(
        newObject[prop],
        ops,
        false,
        false,
      ).newDocument;
    }
    this.dispatchChanges(oldObject, newObject);
  }

  delete(oldObject: GraffitiObjectBase): void {
    this.dispatchChanges(oldObject);
  }

  discover<Schema extends JSONSchema4>(
    channels: string[],
    schema: Schema,
    options?: {
      ifModifiedSince?: Date;
    },
  ): AsyncGenerator<GraffitiObject<Schema>, void, void> {
    const validate = this.ajv.compile(schema);
    const matchOptions = {
      ifModifiedSince: options?.ifModifiedSince,
      channels,
    };
    const repeater = new Repeater<GraffitiObject<Schema>>(
      async (push, stop) => {
        const callback = (event: LocalChangeEvent) => {
          const { oldObject, newObject } = event.detail;

          if (
            newObject &&
            this.matchObject(newObject, matchOptions) &&
            validate(newObject)
          ) {
            push(newObject);
          } else if (
            this.matchObject(oldObject, matchOptions) &&
            validate(oldObject)
          ) {
            push(oldObject);
          }
        };

        this.changes.addEventListener("change", callback as EventListener);
        await stop;
        this.changes.removeEventListener("change", callback as EventListener);
      },
    );

    return repeater;
  }
}
