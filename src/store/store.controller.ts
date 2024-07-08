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
import { StoreSchema, channelsToChannelSchema } from "./store.schema";
import { StoreService } from "./store.service";
import { FastifyReply } from "fastify";
import { Operation } from "fast-json-patch";
import { InfoHash } from "../info-hash/info-hash";
import { rangeToSkipLimit } from "../params/params.utils";

const CONTENT_TYPE = [
  "Content-Type",
  "application/json; charset=utf-8",
] as const;

@Controller()
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Header(...CONTENT_TYPE)
  @Post()
  async queryObjects(
    @Body() query: any,
    @WebId() selfWebId: string | null,
    @Channels() obscuredChannels: string[],
    @Headers("if-modified-since") ifModifiedSinceString?: string,
    @Headers("range") range?: string,
  ) {
    const ifModifiedSince = ifModifiedSinceString
      ? new Date(ifModifiedSinceString)
      : undefined;
    if (ifModifiedSince && isNaN(ifModifiedSince.getTime())) {
      throw new BadRequestException(
        "Invalid date format for if-modified-since header.",
      );
    }

    const { skip, limit } = rangeToSkipLimit(range);

    let infoHashes: string[];
    try {
      infoHashes = obscuredChannels.map<string>((obscuredChannel) =>
        InfoHash.verifyObscuredChannel(obscuredChannel),
      );
    } catch (e) {
      throw new BadRequestException(e.message);
    }

    const iterator = this.storeService.queryObjects(infoHashes, selfWebId, {
      query,
      ifModifiedSince,
      skip,
      limit,
    });

    // Transform it to bytes
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

    // Return the iterator as a stream
    const stream = Readable.from(byteIterator);
    return new StreamableFile(stream);
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
    object.channels = channelsToChannelSchema(channels);
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
