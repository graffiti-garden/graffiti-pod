import { Model } from "mongoose";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { GraffitiObject } from "../schemas/object.schema";

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

  async getObject(
    webId: string,
    name: string,
    selfWebId: string | null,
  ): Promise<GraffitiObject> {
    return this.objectModel.findOne({
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
