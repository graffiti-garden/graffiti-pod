import { Model, Error as MongooseError } from "mongoose";
import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { GraffitiObject } from "../schemas/object.schema";
import { JsonPatchError, applyPatch } from "fast-json-patch";
import type { Operation } from "fast-json-patch";
import { FastifyReply } from "fastify";

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(GraffitiObject.name)
    private objectModel: Model<GraffitiObject>,
  ) {}

  validateWebId(targetWebId: string, selfWebId: string | null) {
    if (!selfWebId) {
      throw new HttpException(
        "You must be authenticated",
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (targetWebId !== selfWebId) {
      throw new HttpException(
        "You can only store your own objects",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  returnObject(
    graffitiObject: GraffitiObject | null,
    selfWebId: string | null,
    response: FastifyReply,
  ): Object {
    if (!graffitiObject) {
      throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    } else {
      if (selfWebId === graffitiObject.webId) {
        response.header("Access-Control-List", graffitiObject.acl);
        response.header("Channels", graffitiObject.channels);
      }
      return graffitiObject.value;
    }
  }

  async putObject(object: GraffitiObject): Promise<GraffitiObject | null> {
    try {
      return await this.objectModel.findOneAndReplace(
        { webId: object.webId, name: object.name },
        object,
        { upsert: true, runValidators: true },
      );
    } catch (e) {
      if (e.name === "ValidationError") {
        throw new HttpException(e.message, HttpStatus.UNPROCESSABLE_ENTITY);
      } else {
        throw e;
      }
    }
  }

  async deleteObject(
    webId: string,
    name: string,
  ): Promise<GraffitiObject | null> {
    return await this.objectModel.findOneAndDelete({ webId, name });
  }

  async patchObject(
    webId: string,
    name: string,
    jsonPatch: Operation[],
  ): Promise<GraffitiObject | null> {
    const doc = await this.objectModel.findOne({ webId, name });
    if (!doc) return doc;
    try {
      doc.value = applyPatch(doc.value, jsonPatch).newDocument;
    } catch (e) {
      if (e.name === "TEST_OPERATION_FAILED") {
        throw new HttpException(e.message, HttpStatus.PRECONDITION_FAILED);
      } else {
        throw e;
      }
    }
    doc.markModified("value");
    try {
      return await doc.save({ validateBeforeSave: true });
    } catch (e) {
      if (e.name == "VersionError") {
        throw new HttpException(
          "Concurrent write, try again.",
          HttpStatus.CONFLICT,
        );
      } else {
        throw e;
      }
    }
  }

  async getObject(
    webId: string,
    name: string,
    selfWebId: string | null,
  ): Promise<GraffitiObject | null> {
    return await this.objectModel.findOne({
      webId,
      name,
      $or: [
        { acl: { $exists: false } },
        { acl: selfWebId },
        { webId: selfWebId },
      ],
    });
  }
}
