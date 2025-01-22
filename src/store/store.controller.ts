import {
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Response,
  Header,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Controller } from "@nestjs/common";
import { DecodeParam } from "../params/decodeparam.decorator";
import { Actor } from "../params/actor.decorator";
import { Channels } from "../params/channels.decorator";
import { Allowed } from "../params/allowed.decorator";
import type { FastifyReply } from "fastify";
import { Schema } from "../params/schema.decorator";
import { StoreService } from "./store.service";
import type {
  Graffiti,
  GraffitiObjectBase,
  GraffitiPatch,
} from "@graffiti-garden/api";
import { GraffitiPouchDBBase } from "@graffiti-garden/implementation-pouchdb";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

const source = "local";

@Controller()
export class StoreController {
  graffiti = new GraffitiPouchDBBase();
  constructor(private storeService: StoreService) {}

  @Get("discover")
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async discover(
    @Actor() selfActor: string | null,
    @Channels() channels: string[],
    @Response({ passthrough: true }) response: FastifyReply,
    @Schema() schema: {},
  ) {
    let iterator: ReturnType<Graffiti["discover"]>;
    try {
      iterator = this.graffiti.discover(
        channels,
        schema,
        selfActor ? { actor: selfActor } : undefined,
      );
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.iteratorToStreamableFile(iterator, response);
  }

  @Put(":actor/:name")
  @Header(...CONTENT_TYPE)
  async put(
    @DecodeParam("actor") actor: string,
    @DecodeParam("name") name: string,
    @Body() value: unknown,
    @Channels() channels: string[],
    @Allowed() allowed: string[] | undefined,
    @Actor() selfActor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateActor(actor, selfActor);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new UnprocessableEntityException("Body must be a JSON object");
    }

    let putted: GraffitiObjectBase;
    try {
      putted = await this.graffiti.put(
        {
          actor,
          channels,
          allowed,
          name,
          source,
          value,
        },
        { actor },
      );
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.returnObject(putted, response, true);
  }

  @Delete(":actor/:name")
  @Header(...CONTENT_TYPE)
  async delete(
    @DecodeParam("actor") actor: string,
    @DecodeParam("name") name: string,
    @Actor() selfActor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateActor(actor, selfActor);
    let deleted: GraffitiObjectBase;
    try {
      deleted = await this.graffiti.delete({ actor, name, source }, { actor });
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(deleted, response);
  }

  @Patch(":actor/:name")
  @Header(...CONTENT_TYPE)
  async patch(
    @DecodeParam("actor") actor: string,
    @DecodeParam("name") name: string,
    @Body() valuePatch: unknown,
    @Channels() channelsPatchStringArray: string[],
    @Allowed() allowedPatchStringArray: string[] | undefined,
    @Actor() selfActor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateActor(actor, selfActor);

    const patches: GraffitiPatch = {};
    if (valuePatch) {
      if (Array.isArray(valuePatch)) {
        patches.value = valuePatch;
      } else {
        throw new UnprocessableEntityException("Value patch is not an array");
      }
    }
    for (const [key, patchStringArray] of [
      ["channels", channelsPatchStringArray],
      ["allowed", allowedPatchStringArray],
    ] as const) {
      try {
        patches[key] = patchStringArray?.map((patchString) =>
          JSON.parse(patchString),
        );
      } catch {
        throw new UnprocessableEntityException(`Invalid ${key} patch`);
      }
    }

    let patched: GraffitiObjectBase;
    try {
      patched = await this.graffiti.patch(
        patches,
        { actor, name, source },
        { actor },
      );
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(patched, response);
  }

  @Get(":actor/:name")
  @Header(...CONTENT_TYPE)
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async get(
    @DecodeParam("actor") actor: string,
    @DecodeParam("name") name: string,
    @Actor() selfActor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    let gotten: GraffitiObjectBase;
    try {
      gotten = await this.graffiti.get(
        { actor, name, source },
        {},
        selfActor ? { actor: selfActor } : undefined,
      );
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(gotten, response);
  }
}
