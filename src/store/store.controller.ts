import {
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Response,
  Header,
  BadRequestException,
  StreamableFile,
} from "@nestjs/common";
import { Readable } from "stream";
import { Controller } from "@nestjs/common";
import { DecodeParam } from "../params/decodeparam.decorator";
import { WebId } from "../params/webid.decorator";
import { Channels } from "../params/channels.decorator";
import { AccessControlList } from "../params/acl.decorator";
import { StoreSchema } from "./store.schema";
import { StoreService } from "./store.service";
import { FastifyReply } from "fastify";
import { Operation } from "fast-json-patch";
import { IfModifiedSince } from "../params/if-modified-since.decorator";
import { Range } from "../params/range.decorator";
import { Schema } from "../params/schema.decorator";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

const CACHE_CONTROL = ["Cache-Control", "private, max-age=300"] as const;

@Controller()
export class StoreController {
  constructor(private storeService: StoreService) {}

  iteratorToStreamableFile(
    iterator: AsyncGenerator<any, void, void>,
  ): StreamableFile {
    const byteIterator = (async function* () {
      let first = true;
      for await (const object of iterator) {
        if (!first) {
          yield Buffer.from("\n");
        } else {
          first = false;
        }
        yield Buffer.from(JSON.stringify(object));
      }
    })();
    const stream = Readable.from(byteIterator);
    return new StreamableFile(stream, {
      type: "text/plain",
    });
  }

  @Get("discover")
  @Header(...CACHE_CONTROL)
  @Header("Vary", "Authorization, If-Modified-Since, Range")
  async queryObjects(
    @WebId() selfWebId: string | null,
    @Channels() channels: string[],
    @Range() range: { skip?: number; limit?: number },
    @Schema() schema?: any,
    @IfModifiedSince() ifModifiedSince?: Date,
  ) {
    const iterator = this.storeService.queryObjects(channels, selfWebId, {
      query: schema,
      ifModifiedSince,
      skip: range.skip,
      limit: range.limit,
    });
    return this.iteratorToStreamableFile(iterator);
  }

  @Get("list-channels")
  @Header(...CACHE_CONTROL)
  @Header("Vary", "Authorization, If-Modified-Since")
  async listChannels(
    @WebId() selfWebId: string | null,
    @IfModifiedSince() ifModifiedSince?: Date,
  ) {
    this.storeService.validateWebId(selfWebId, selfWebId);
    const iterator = this.storeService.listChannels(selfWebId, {
      ifModifiedSince,
    });
    return this.iteratorToStreamableFile(iterator);
  }

  @Get("list-orphans")
  @Header(...CACHE_CONTROL)
  @Header("Vary", "Authorization, If-Modified-Since")
  async listOrphans(
    @WebId() selfWebId: string | null,
    @IfModifiedSince() ifModifiedSince?: Date,
  ) {
    this.storeService.validateWebId(selfWebId, selfWebId);
    const iterator = this.storeService.listOrphans(selfWebId, {
      ifModifiedSince,
    });
    return this.iteratorToStreamableFile(iterator);
  }

  @Put(":webId/:name")
  @Header(...CONTENT_TYPE)
  async putObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @Body() value: any,
    @Channels() channels: string[],
    @AccessControlList() acl: string[] | undefined,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateWebId(webId, selfWebId);

    // Create an instance of a GraffitiObject
    const object = new StoreSchema();
    object.webId = webId;
    object.name = name;
    object.value = value;
    object.channels = channels;
    object.acl = acl;

    const putted = await this.storeService.putObject(object);
    return this.storeService.returnObject(putted, selfWebId, response, true);
  }

  @Delete(":webId/:name")
  @Header(...CONTENT_TYPE)
  async deleteObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateWebId(webId, selfWebId);
    const deleted = await this.storeService.deleteObject(webId, name);
    return this.storeService.returnObject(deleted, selfWebId, response);
  }

  @Patch(":webId/:name")
  @Header(...CONTENT_TYPE)
  async patchObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @Body() valuePatch: any,
    @Channels() channelsPatchStringArray: string[],
    @AccessControlList() aclPatchStringArray: string[] | undefined,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    const patches: {
      value?: Operation[];
      acl?: Operation[];
      channels?: Operation[];
    } = {};
    if (valuePatch) {
      patches.value = valuePatch;
    }
    for (const [key, patchStringArray] of [
      ["channels", channelsPatchStringArray],
      ["acl", aclPatchStringArray],
    ] as const) {
      try {
        patches[key] = patchStringArray?.map((patchString) =>
          JSON.parse(patchString),
        );
      } catch {
        throw new BadRequestException(`Invalid ${key} patch`);
      }
    }
    this.storeService.validateWebId(webId, selfWebId);
    const patched = await this.storeService.patchObject(webId, name, patches);
    return this.storeService.returnObject(patched, selfWebId, response);
  }

  @Get(":webId/:name")
  @Header(...CONTENT_TYPE)
  @Header(...CACHE_CONTROL)
  @Header("Vary", "Authorization")
  async getObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    const gotten = await this.storeService.getObject(webId, name, selfWebId);
    return this.storeService.returnObject(gotten, selfWebId, response);
  }
}
