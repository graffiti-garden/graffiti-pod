import { Model, PipelineStage } from "mongoose";
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  PreconditionFailedException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { StoreSchema } from "./store.schema";
import { JsonPatchError, applyPatch } from "fast-json-patch";
import type { Operation } from "fast-json-patch";
import { FastifyReply } from "fastify";
import { InfoHashService } from "../info-hash/info-hash.service";
import type { JSONSchema4 } from "json-schema";

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(StoreSchema.name)
    private storeModel: Model<StoreSchema>,
    private infoHashService: InfoHashService,
  ) {}

  validateWebId(targetWebId: string, selfWebId: string | null) {
    if (!selfWebId) {
      throw new UnauthorizedException();
    }
    if (targetWebId !== selfWebId) {
      throw new ForbiddenException();
    }
  }

  returnObject(
    object: StoreSchema | null,
    selfWebId: string | null,
    response: FastifyReply,
  ): Object {
    if (!object) {
      throw new NotFoundException();
    } else {
      if (selfWebId === object.webId) {
        response.header("Access-Control-List", object.acl);
        response.header("Channels", object.channels);
      }
      return object.value;
    }
  }

  async putObject(object: StoreSchema): Promise<StoreSchema | null> {
    // Convert channels to info hashes, if not already
    if (!object.infoHashes) {
      if (!object.channels) {
        throw new UnprocessableEntityException("Channels are required");
      }
      object.infoHashes = object.channels.map<string>((channel: any) => {
        if (typeof channel !== "string" || !channel) {
          throw new UnprocessableEntityException("Channels must be strings");
        }
        return this.infoHashService.toInfoHash(channel);
      });
    }

    try {
      return await this.storeModel.findOneAndReplace(
        { webId: object.webId, name: object.name },
        object,
        { upsert: true, runValidators: true },
      );
    } catch (e) {
      if (e.name === "ValidationError") {
        throw new UnprocessableEntityException(e.message);
      } else {
        throw e;
      }
    }
  }

  async deleteObject(webId: string, name: string): Promise<StoreSchema | null> {
    return await this.storeModel.findOneAndDelete({ webId, name });
  }

  async patchObject(
    webId: string,
    name: string,
    jsonPatch: Operation[],
  ): Promise<StoreSchema | null> {
    const doc = await this.storeModel.findOne({ webId, name });
    if (!doc) return doc;
    try {
      doc.value = applyPatch(doc.value, jsonPatch, true).newDocument;
    } catch (e) {
      if (e.name === "TEST_OPERATION_FAILED") {
        throw new PreconditionFailedException(e.message);
      } else if (e instanceof JsonPatchError) {
        throw new BadRequestException(e.message);
      } else {
        throw e;
      }
    }
    doc.markModified("value");
    try {
      return await doc.save({ validateBeforeSave: true });
    } catch (e) {
      if (e.name == "VersionError") {
        throw new ConflictException("Concurrent write, try again.");
      } else {
        throw e;
      }
    }
  }

  private aclQuery(selfWebId: string | null) {
    return {
      $or: [
        { acl: { $exists: false } },
        { acl: selfWebId },
        { webId: selfWebId! },
      ],
    };
  }

  async getObject(
    webId: string,
    name: string,
    selfWebId: string | null,
  ): Promise<StoreSchema | null> {
    return await this.storeModel.findOne({
      webId,
      name,
      ...this.aclQuery(selfWebId),
    });
  }

  private removeIfNotOwner(prop: string, selfWebId: string | null) {
    return {
      $cond: {
        if: { $eq: ["$webId", selfWebId] },
        then: `$${prop}`,
        else: "$$REMOVE",
      },
    };
  }

  async *queryObjects(
    infoHashes: string[],
    selfWebId: string | null,
    options?: {
      query?: JSONSchema4;
      limit?: number;
    },
  ): AsyncGenerator<StoreSchema, void, void> {
    const pipeline: PipelineStage[] = [
      // Reduce to only documents that contain
      // at least one of the info hashes that
      // the user is authorized to access
      {
        $match: {
          infoHashes: { $elemMatch: { $in: infoHashes } },
          ...this.aclQuery(selfWebId),
        },
      },
      // Mask out the _id, infoHashes, channels, and acl fields
      // if the user is not the owner of the document
      {
        $project: {
          _id: 0,
          value: 1,
          webId: 1,
          name: 1,
          infoHashes: this.removeIfNotOwner("infoHashes", selfWebId),
          channels: this.removeIfNotOwner("channels", selfWebId),
          acl: this.removeIfNotOwner("acl", selfWebId),
        },
      },
    ];
    if (options?.query) {
      pipeline.push({ $match: { $jsonSchema: options.query } });
    }
    if (options?.limit) {
      pipeline.push({ $limit: options.limit });
    }

    for await (const doc of this.storeModel.aggregate(pipeline)) {
      yield doc;
    }
  }
}
