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
import { StoreService, TOMBSTONE_MAX_AGE_MS } from "./store.service";
import { FastifyReply } from "fastify";
import { Operation } from "fast-json-patch";
import { IfModifiedSince } from "../params/if-modified-since.decorator";
import { Range } from "../params/range.decorator";
import { Schema } from "../params/schema.decorator";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

const FEED_CACHE_CONTROL = [
  "Cache-Control",
  `private, no-store, im, max-age=${TOMBSTONE_MAX_AGE_MS / 1000}`,
] as const;

@Controller()
export class StoreController {
  constructor(private storeService: StoreService) {}

  async iteratorToStreamableFile(
    iterator: AsyncGenerator<
      {
        lastModified: Date;
      },
      void,
      void
    >,
    response: FastifyReply,
    ifModifiedSince: Date | undefined,
  ): Promise<StreamableFile> {
    // See: https://bobwyman.typepad.com/main/2004/09/using_rfc3229_w.html
    // and: https://www.ctrl.blog/entry/feed-delta-updates.html

    const firstObject = await iterator.next();
    if (firstObject.done) {
      if (ifModifiedSince) {
        response.status(304);
        response.header("last-modified", ifModifiedSince.toISOString());
      } else {
        response.status(204);
      }
    } else {
      response.header(
        "last-modified",
        firstObject.value.lastModified.toISOString(),
      );
      if (ifModifiedSince) {
        response.status(226);
        response.header("IM", "prepend");
      } else {
        response.status(200);
      }
    }

    const byteIterator = (async function* () {
      if (firstObject.done) return;
      yield Buffer.from(JSON.stringify(firstObject.value));
      for await (const object of iterator) {
        yield Buffer.from("\n");
        yield Buffer.from(JSON.stringify(object));
      }
    })();
    const stream = Readable.from(byteIterator);
    return new StreamableFile(stream, {
      type: "text/plain",
    });
  }

  @Get("discover")
  @Header(...FEED_CACHE_CONTROL)
  @Header("Vary", "Authorization, If-Modified-Since, Range")
  async queryObjects(
    @WebId() selfWebId: string | null,
    @Channels() channels: string[],
    @Range() range: { skip?: number; limit?: number },
    @Response({ passthrough: true }) response: FastifyReply,
    @Schema() schema?: any,
    @IfModifiedSince() ifModifiedSince?: Date,
  ) {
    const iterator = this.storeService.queryObjects(channels, selfWebId, {
      query: schema,
      ifModifiedSince,
      skip: range.skip,
      limit: range.limit,
    });
    return this.iteratorToStreamableFile(iterator, response, ifModifiedSince);
  }

  @Get("list-channels")
  @Header(...FEED_CACHE_CONTROL)
  @Header("Vary", "Authorization, If-Modified-Since")
  async listChannels(
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
    @IfModifiedSince() ifModifiedSince?: Date,
  ) {
    this.storeService.validateWebId(selfWebId, selfWebId);
    const iterator = this.storeService.listChannels(selfWebId, {
      ifModifiedSince,
    });
    return this.iteratorToStreamableFile(iterator, response, ifModifiedSince);
  }

  @Get("list-orphans")
  @Header(...FEED_CACHE_CONTROL)
  @Header("Vary", "Authorization, If-Modified-Since")
  async listOrphans(
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
    @IfModifiedSince() ifModifiedSince?: Date,
  ) {
    this.storeService.validateWebId(selfWebId, selfWebId);
    const iterator = this.storeService.listOrphans(selfWebId, {
      ifModifiedSince,
    });
    return this.iteratorToStreamableFile(iterator, response, ifModifiedSince);
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
  @Header("Cache-Control", "private, no-cache")
  @Header("Vary", "Authorization")
  async getObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
    @IfModifiedSince() ifModifiedSince?: Date,
  ) {
    const gotten = await this.storeService.getObject(webId, name, selfWebId);
    if (gotten && ifModifiedSince && gotten.lastModified <= ifModifiedSince) {
      response.status(304);
      response.header("last-modified", gotten.lastModified.toISOString());
      return;
    }
    return this.storeService.returnObject(gotten, selfWebId, response);
  }
}
