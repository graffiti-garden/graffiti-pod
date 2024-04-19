import { Get, Put, Delete, Patch, Body, Response } from "@nestjs/common";
import { Controller } from "@nestjs/common";
import { DecodeParam } from "../params/decodeparam.decorator";
import { WebId } from "../params/webid.decorator";
import { Channels } from "../params/channels.decorator";
import { AccessControlList } from "../params/acl.decorator";
import { GraffitiObject } from "../schemas/object.schema";
import { StoreService } from "./store.service";
import { FastifyReply } from "fastify";

@Controller("s/:webId/:name")
export class StoreController {
  constructor(private storeService: StoreService) {}

  @Put()
  async putObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @Body() object: any,
    @Channels() channels: string[],
    @AccessControlList() acl: string[] | undefined,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateWebId(webId, selfWebId);

    // Create an instance of a GraffitiObject
    const graffitiObject = new GraffitiObject();
    graffitiObject.webId = webId;
    graffitiObject.name = name;
    graffitiObject.value = object;
    graffitiObject.channels = channels;
    graffitiObject.acl = acl;

    const putted = await this.storeService.putObject(graffitiObject);
    return this.storeService.returnObject(putted, selfWebId, response);
  }

  @Delete()
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

  @Patch()
  async patchObject(
    @DecodeParam("webId") webId: string,
    @DecodeParam("name") name: string,
    @Body() jsonPatch: any,
    @WebId() selfWebId: string | null,
    @Response({ passthrough: true }) response: FastifyReply,
  ) {
    this.storeService.validateWebId(webId, selfWebId);
    const patched = await this.storeService.patchObject(webId, name, jsonPatch);
    return this.storeService.returnObject(patched, selfWebId, response);
  }

  @Get()
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
