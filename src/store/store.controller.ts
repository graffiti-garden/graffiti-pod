import {
  Get,
  Put,
  Delete,
  Patch,
  Body,
  Response,
  Header,
  Headers,
  Post,
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
import { rangeToSkipLimit, parseDateString } from "../params/params.utils";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

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

  @Post()
  async queryObjects(
    @Body() query: any,
    @WebId() selfWebId: string | null,
    @Channels() channels: string[],
    @Headers("if-modified-since") ifModifiedSinceString?: string,
    @Headers("range") range?: string,
  ) {
    const { skip, limit } = rangeToSkipLimit(range);
    const ifModifiedSince = parseDateString(ifModifiedSinceString);
    const iterator = this.storeService.queryObjects(channels, selfWebId, {
      query,
      ifModifiedSince,
      skip,
      limit,
    });
    return this.iteratorToStreamableFile(iterator);
  }

  @Post("list-channels")
  async listChannels(
    @WebId() selfWebId: string | null,
    @Headers("if-modified-since") ifModifiedSinceString?: string,
  ) {
    this.storeService.validateWebId(selfWebId, selfWebId);
    const ifModifiedSince = parseDateString(ifModifiedSinceString);
    const iterator = this.storeService.listChannels(selfWebId, {
      ifModifiedSince,
    });
    return this.iteratorToStreamableFile(iterator);
  }

  @Post("list-orphans")
  async listOrphans(
    @WebId() selfWebId: string | null,
    @Headers("if-modified-since") ifModifiedSinceString?: string,
  ) {
    this.storeService.validateWebId(selfWebId, selfWebId);
    const ifModifiedSince = parseDateString(ifModifiedSinceString);
    const iterator = this.storeService.listOrphans(selfWebId, {
      ifModifiedSince,
    });
    return this.iteratorToStreamableFile(iterator);
  }

  @Header(...CONTENT_TYPE)
  @Put(":webId/:name")
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

  @Header(...CONTENT_TYPE)
  @Delete(":webId/:name")
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

  @Header(...CONTENT_TYPE)
  @Patch(":webId/:name")
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

  @Header(...CONTENT_TYPE)
  @Get(":webId/:name")
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
