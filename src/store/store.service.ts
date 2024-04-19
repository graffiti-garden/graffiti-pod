import { Model } from "mongoose";
import { Injectable, HttpException, HttpStatus } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { GraffitiObject } from "../schemas/object.schema";
import { applyPatch, JsonPatchError } from "fast-json-patch";
import type { Operation } from "fast-json-patch";

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(GraffitiObject.name)
    private objectModel: Model<GraffitiObject>,
  ) {}

  async putObject(object: GraffitiObject): Promise<GraffitiObject> {
    return await this.objectModel.findOneAndReplace(
      { webId: object.webId, name: object.name },
      object,
      { upsert: true, runValidators: true },
    );
  }

  async deleteObject(webId: string, name: string): Promise<GraffitiObject> {
    return await this.objectModel.findOneAndDelete({ webId, name });
  }

  async patchObject(
    webId: string,
    name: string,
    jsonPatch: Operation[],
  ): Promise<GraffitiObject> {
    const doc = await this.objectModel.findOne({ webId, name });
    if (!doc) {
      throw new HttpException(
        "The doc you're trying to patch can't be found.",
        HttpStatus.NOT_FOUND,
      );
    }
    try {
      doc.value = applyPatch(doc.value, jsonPatch).newDocument;
    } catch (e) {
      if (e instanceof JsonPatchError) {
        throw new HttpException(e.message, HttpStatus.BAD_REQUEST);
      } else {
        throw new HttpException("Bad request.", HttpStatus.BAD_REQUEST);
      }
    }
    doc.markModified("value");
    return await doc.save({ validateBeforeSave: true });
  }

  async getObject(
    webId: string,
    name: string,
    selfWebId: string | null,
  ): Promise<GraffitiObject> {
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
