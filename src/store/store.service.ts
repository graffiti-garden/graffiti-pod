import { Model, PipelineStage, Document } from "mongoose";
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  PreconditionFailedException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {
  StoreSchema,
  channelSchemaToChannels,
  channelsToChannelSchema,
} from "./store.schema";
import { JsonPatchError, applyPatch } from "fast-json-patch";
import type { Operation } from "fast-json-patch";
import { FastifyReply } from "fastify";
import type { JSONSchema4 } from "json-schema";
import { encodeHeaderArray } from "../params/params.utils";

@Injectable()
export class StoreService {
  constructor(
    @InjectModel(StoreSchema.name)
    private storeModel: Model<StoreSchema>,
  ) {}

  validateWebId(targetWebId: string, selfWebId: string | null) {
    if (!selfWebId) {
      throw new UnauthorizedException(
        "You must be logged in to access this resource.",
      );
    }
    if (targetWebId !== selfWebId) {
      throw new ForbiddenException("You are not the owner of this resource.");
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
        throw new NotFoundException(
          "Cannot GET object - either it does not exist or you do not have access to it.",
        );
      }
    } else {
      if (selfWebId === object.webId) {
        if (object.acl) {
          response.header("access-control-list", encodeHeaderArray(object.acl));
        }
        response.header(
          "channels",
          encodeHeaderArray(channelSchemaToChannels(object.channels)),
        );
      }
      response.header("last-modified", object.lastModified.toUTCString());
      return object.value;
    }
  }

  async deleteObject(webId: string, name: string, modifiedBefore?: Date) {
    return await this.storeModel.findOneAndUpdate(
      {
        webId,
        name,
        tombstone: false,
        ...(modifiedBefore ? { lastModified: { $lt: modifiedBefore } } : {}),
      },
      { $set: { tombstone: true } },
      {
        sort: { lastModified: 1 },
      },
    );
  }

  async getObject(
    webId: string,
    name: string,
    selfWebId: string | null,
  ): Promise<(Document<unknown, {}, StoreSchema> & StoreSchema) | null> {
    return await this.storeModel.findOne(
      {
        webId,
        name,
        tombstone: false,
        ...this.aclQuery(selfWebId),
      },
      null,
      {
        sort: { lastModified: -1 },
      },
    );
  }

  async putObject(object: StoreSchema) {
    // Try to insert the object
    let putObject: StoreSchema;
    try {
      putObject = await new this.storeModel(object).save();
    } catch (e) {
      if (e.name === "ValidationError") {
        throw new UnprocessableEntityException(e.message);
      } else {
        throw e;
      }
    }

    // Apply tombstones to other objects
    return await this.deleteObject(
      object.webId,
      object.name,
      putObject.lastModified,
    );
  }

  async patchObject(
    webId: string,
    name: string,
    patches: {
      value?: Operation[];
      acl?: Operation[];
      channels?: Operation[];
    },
  ): Promise<StoreSchema | null> {
    // Get the original
    const doc = await this.getObject(webId, name, webId);
    if (!doc) return doc;

    // Patch it outside of the database
    for (const [prop, patch] of Object.entries(patches)) {
      if (!patch) continue;
      if (!Array.isArray(patch)) {
        throw new UnprocessableEntityException(
          `Patch of ${prop} must be an array`,
        );
      }
      if (!patch.length) continue;
      const input =
        prop === "channels" ? channelSchemaToChannels(doc[prop]) : doc[prop];
      let patched: any;
      try {
        patched = applyPatch(input, patch, true).newDocument;
      } catch (e) {
        if (e.name === "TEST_OPERATION_FAILED") {
          throw new PreconditionFailedException(e.message);
        } else if (e instanceof JsonPatchError) {
          throw new UnprocessableEntityException(e.message);
        } else {
          throw e;
        }
      }
      try {
        doc[prop] =
          prop === "channels" ? channelsToChannelSchema(patched) : patched;
      } catch (e) {
        throw new UnprocessableEntityException(
          `Patch of ${prop} resulted in invalid data`,
        );
      }
      doc.markModified(prop);
    }

    // Force the doc to be new
    doc.isNew = true;
    doc._id = undefined;

    // Try and save the patched object
    let patchedObject: StoreSchema;
    try {
      patchedObject = await doc.save();
    } catch (e) {
      if (e.name == "VersionError") {
        throw new ConflictException("Concurrent write, try again.");
      } else if (e.name === "ValidationError") {
        throw new UnprocessableEntityException(e.message);
      } else {
        throw e;
      }
    }

    // Delete and return the original object
    return await this.deleteObject(webId, name, patchedObject.lastModified);
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
          _id: "$channels.value",
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
      skip?: number;
    },
  ): AsyncGenerator<StoreSchema, void, void> {
    const pipeline: PipelineStage[] = [
      // Reduce to only documents that contain
      // at least one of the info hashes that
      // the user is authorized to access before
      // the given time.
      {
        $match: {
          channels: { $elemMatch: { infoHash: { $in: infoHashes } } },
          ...this.aclQuery(selfWebId),
          ...this.modifiedSinceQuery(options?.modifiedSince),
        },
      },
      {
        $sort: { lastModified: 1 },
      },
      // Group by webId and name and reduce to only the latest
      // version of each document
      {
        $group: {
          _id: { webId: "$webId", name: "$name" },
          value: { $last: "$value" },
          webId: { $last: "$webId" },
          name: { $last: "$name" },
          lastModified: { $last: "$lastModified" },
          acl: { $last: "$acl" },
          channels: { $last: "$channels" },
          tombstone: { $last: "$tombstone" },
        },
      },
      // Mask out the value if the object has been deleted
      // (ie tombstone is true)
      // Mask out the _id and if user is not the owner
      // and filter infoHashes and channels to only
      // the supplied infoHashes
      {
        $project: {
          _id: 0,
          tombstone: 1,
          value: {
            $cond: {
              if: "$tombstone",
              then: "$$REMOVE",
              else: "$value",
            },
          },
          webId: 1,
          name: 1,
          lastModified: 1,
          acl: this.ifNotOwner("acl", selfWebId, "$$REMOVE"),
          channels: this.ifNotOwner("channels", selfWebId, {
            $filter: {
              input: "$channels",
              as: "channel",
              cond: {
                $in: ["$$channel.infoHash", infoHashes],
              },
            },
          }),
        },
      },
    ];
    if (options?.query) {
      pipeline.push({ $match: { $jsonSchema: options.query } });
    }
    if (options?.skip) {
      pipeline.push({ $skip: options.skip });
    }
    if (options?.limit) {
      pipeline.push({ $limit: options.limit });
    }

    for await (const doc of this.storeModel.aggregate(pipeline)) {
      yield doc;
    }
  }
}
