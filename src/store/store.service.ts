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
import { encodeHeaderArray } from "../params/params.utils";

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
    put: boolean = false,
  ): Object | void {
    if (!object) {
      if (put) {
        response.status(201);
        return;
      } else {
        throw new NotFoundException();
      }
    } else {
      if (selfWebId === object.webId) {
        if (object.acl) {
          response.header("access-control-list", encodeHeaderArray(object.acl));
        }
        response.header("channels", encodeHeaderArray(object.channels));
      }
      response.header("last-modified", object.lastModified.toUTCString());
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
      } else if (e.name === "ValidationError") {
        throw new UnprocessableEntityException(e.message);
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

  private ifNotOwner(prop: string, selfWebId: string | null, otherwise: any) {
    return {
      $cond: {
        if: { $eq: ["$webId", selfWebId] },
        then: `$${prop}`,
        else: otherwise,
      },
    };
  }

  private modifiedSinceQuery(modifiedSince?: Date) {
    return modifiedSince ? { lastModified: { $gte: modifiedSince } } : {};
  }

  async *listChannels(
    selfWebId: string | null,
    options?: {
      modifiedSince?: Date;
    },
  ): AsyncGenerator<
    {
      lastModified: Date;
      channel: string;
    },
    void,
    void
  > {
    for await (const output of this.storeModel.aggregate([
      {
        $match: {
          webId: selfWebId,
          ...this.modifiedSinceQuery(options?.modifiedSince),
        },
      },
      { $project: { _id: 0, channels: 1, lastModified: 1 } },
      {
        $unwind: {
          path: "$channels",
        },
      },
      {
        $group: {
          _id: "$channels",
          lastModified: { $max: "$lastModified" },
        },
      },
      {
        $project: {
          _id: 0,
          channel: "$_id",
          lastModified: 1,
        },
      },
    ])) {
      yield output;
    }
  }

  async *queryObjects(
    infoHashes: string[],
    selfWebId: string | null,
    options?: {
      modifiedSince?: Date;
      query?: JSONSchema4;
      limit?: number;
    },
  ): AsyncGenerator<StoreSchema, void, void> {
    const pipeline: PipelineStage[] = [
      // Reduce to only documents that contain
      // at least one of the info hashes that
      // the user is authorized to access before
      // the given time.
      {
        $match: {
          infoHashes: { $elemMatch: { $in: infoHashes } },
          ...this.aclQuery(selfWebId),
          ...(options?.modifiedSince
            ? { lastModified: { $gt: options?.modifiedSince } }
            : {}),
        },
      },
      // Mask out the _id and if user is not the owner
      // and filter infoHashes and channels to only
      // the supplied infoHashes
      {
        $project: {
          _id: 0,
          value: 1,
          webId: 1,
          name: 1,
          lastModified: 1,
          acl: this.ifNotOwner("acl", selfWebId, "$$REMOVE"),
          infoHashes: this.ifNotOwner("infoHashes", selfWebId, {
            $filter: {
              input: "$infoHashes",
              as: "infoHash",
              cond: { $in: ["$$infoHash", infoHashes] },
            },
          }),
          channels: this.ifNotOwner("channels", selfWebId, {
            $filter: {
              input: {
                $map: {
                  input: "$infoHashes",
                  as: "infoHash",
                  in: {
                    $cond: {
                      if: {
                        $in: ["$$infoHash", infoHashes],
                      },
                      then: {
                        $arrayElemAt: [
                          "$channels",
                          { $indexOfArray: ["$infoHashes", "$$infoHash"] },
                        ],
                      },
                      else: null,
                    },
                  },
                },
              },
              as: "channel",
              cond: { $ne: ["$$channel", null] },
            },
          }),
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
