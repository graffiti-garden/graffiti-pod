import {
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Response,
  Header,
  UnprocessableEntityException,
  Inject,
  Optional,
  UnauthorizedException,
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
import {
  GraffitiLocalDatabase,
  type GraffitiLocalOptions,
} from "@graffiti-garden/implementation-local/database";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

@Controller()
export class StoreController {
  readonly graffiti: GraffitiLocalDatabase;
  readonly source: string;

  constructor(
    private readonly storeService: StoreService,
    @Optional()
    @Inject("GRAFFITI_POUCHDB_OPTIONS")
    private readonly options?: GraffitiLocalOptions,
  ) {
    this.source = this.options?.sourceName ?? "http://localhost:3000";
    options = {
      ...options,
      sourceName: this.source,
    };
    this.graffiti = new GraffitiLocalDatabase(options);
  }

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

  @Get("channel-stats")
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async channelStats(
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    if (!actor) {
      throw new UnauthorizedException(
        "You must be logged in to look up your channel statistics",
      );
    }
    let iterator: ReturnType<Graffiti["channelStats"]>;
    try {
      iterator = this.graffiti.channelStats({ actor });
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.iteratorToStreamableFile(iterator, response);
  }

  @Get("recover-orphans")
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async recoverOrphans(
    @Actor() actor: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
    @Schema() schema: {},
  ) {
    if (!actor) {
      throw new UnauthorizedException(
        "You must be logged in to recover your orpaned objects",
      );
    }
    let iterator: ReturnType<Graffiti["recoverOrphans"]>;
    try {
      iterator = this.graffiti.recoverOrphans(schema, { actor });
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
          source: this.source,
          value,
        },
        { actor },
      );
    } catch (error) {
      throw this.storeService.catchGraffitiError(error);
    }

    return this.storeService.returnObject(putted, response, "put");
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
      deleted = await this.graffiti.delete(
        { actor, name, source: this.source },
        { actor },
      );
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(deleted, response, "delete");
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
        { actor, name, source: this.source },
        { actor },
      );
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(patched, response, "patch");
  }

  @Get(":actor/:name")
  @Header(...CONTENT_TYPE)
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async get(
    @DecodeParam("actor") actor: string,
    @DecodeParam("name") name: string,
    @Actor() selfActor: string | null,
    @Schema() schema: {},
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    let gotten: GraffitiObjectBase;
    try {
      gotten = await this.graffiti.get(
        { actor, name, source: this.source },
        schema,
        selfActor ? { actor: selfActor } : undefined,
      );
    } catch (e) {
      throw this.storeService.catchGraffitiError(e);
    }
    return this.storeService.returnObject(gotten, response, "get");
  }
}
