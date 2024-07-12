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
import { StoreSchema } from "./store.schema";
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

  validateWebId(targetWebId: string | null, selfWebId: string | null) {
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
        response.header("channels", encodeHeaderArray(object.channels));
      }
      response.header("last-modified", object.lastModified.toISOString());
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
      {
        $set: {
          tombstone: true,
          // Set the modified date to the
          // same date as the requesting date
          ...(modifiedBefore ? { lastModified: modifiedBefore } : {}),
        },
      },
      {
        sort: { lastModified: 1 },
        timestamps: !modifiedBefore,
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
      try {
        doc[prop] = applyPatch(doc[prop], patch, true).newDocument;
      } catch (e) {
        if (e.name === "TEST_OPERATION_FAILED") {
          throw new PreconditionFailedException(e.message);
        } else if (e instanceof JsonPatchError) {
          throw new UnprocessableEntityException(e.message);
        } else {
          throw e;
        }
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

  private ifModifiedSinceQuery(ifModifiedSince?: Date) {
    return ifModifiedSince ? { lastModified: { $gte: ifModifiedSince } } : {};
  }

  async *listOrphans(
    selfWebId: string | null,
    options?: {
      ifModifiedSince?: Date;
    },
  ): AsyncGenerator<
    {
      name: string;
      lastModified: Date;
      tombstone: boolean;
    },
    void,
    void
  > {
    for await (const output of this.storeModel.aggregate([
      // Find all objects that have no channels,
      // are owned by the user, and have been modified
      // since the ifModifiedSince date
      {
        $match: {
          webId: selfWebId,
          channels: { $size: 0 },
          ...this.ifModifiedSinceQuery(options?.ifModifiedSince),
        },
      },
      // Filter out ACL, channels, and value which aren't relevant here.
      {
        $project: {
          _id: 0,
          name: 1,
          lastModified: 1,
          tombstone: 1,
        },
      },
      // Get the most recent version of each object
      {
        $sort: { lastModified: 1, tombstone: -1 },
      },
      {
        $group: {
          _id: "$name",
          lastModified: { $last: "$lastModified" },
          tombstone: { $last: "$tombstone" },
        },
      },
      // Fix the output
      {
        $project: {
          _id: 0,
          name: "$_id",
          lastModified: 1,
          tombstone: 1,
        },
      },
    ])) {
      yield output;
    }
  }

  async *listChannels(
    selfWebId: string | null,
    options?: {
      ifModifiedSince?: Date;
    },
  ): AsyncGenerator<
    {
      channel: string;
      count: number;
      lastModified: Date;
    },
    void,
    void
  > {
    for await (const output of this.storeModel.aggregate([
      // Get all documents that have at least one channel
      // and are owned by the current user
      {
        $match: {
          webId: selfWebId,
          channels: { $exists: true, $ne: [] },
        },
      },
      // This may return a lot of results, so filter out
      // the values and ACL since they're not needed here
      {
        $project: {
          _id: 0,
          channels: 1,
          lastModified: 1,
          name: 1,
          tombstone: 1,
        },
      },
      // Get the most recent version of
      // each document, per channel
      {
        $unwind: "$channels",
      },
      {
        $sort: { lastModified: 1, tombstone: -1 },
      },
      {
        $group: {
          _id: {
            name: "$name",
            channel: "$channels",
          },
          lastModified: { $last: "$lastModified" },
          tombstone: { $last: "$tombstone" },
        },
      },
      // Count up the remaining objects in each channel
      {
        $group: {
          _id: "$_id.channel",
          count: {
            $sum: {
              $cond: {
                if: "$tombstone",
                then: 0,
                else: 1,
              },
            },
          },
          lastModified: { $max: "$lastModified" },
        },
      },
      // Filter out anything old
      {
        $match: this.ifModifiedSinceQuery(options?.ifModifiedSince),
      },
      // And fix the output
      {
        $project: {
          _id: 0,
          channel: "$_id",
          count: 1,
          lastModified: 1,
        },
      },
    ])) {
      yield output;
    }
  }

  async *queryObjects(
    channels: string[],
    selfWebId: string | null,
    options?: {
      ifModifiedSince?: Date;
      query?: JSONSchema4;
      limit?: number;
      skip?: number;
    },
  ): AsyncGenerator<StoreSchema, void, void> {
    const pipeline: PipelineStage[] = [
      // Reduce to only documents that contain
      // at least one of the channels that
      // the user is authorized to access before
      // the given time.
      {
        $match: {
          channels: { $elemMatch: { $in: channels } },
          ...this.aclQuery(selfWebId),
          ...this.ifModifiedSinceQuery(options?.ifModifiedSince),
        },
      },
      // Mask out channels and ACL the user should not be able to query
      {
        $project: {
          _id: 0,
          tombstone: 1,
          value: 1,
          webId: 1,
          name: 1,
          lastModified: 1,
          acl: this.ifNotOwner("acl", selfWebId, "$$REMOVE"),
          channels: this.ifNotOwner("channels", selfWebId, {
            $filter: {
              input: "$channels",
              as: "channel",
              cond: {
                $in: ["$$channel", channels],
              },
            },
          }),
        },
      },
      // Perform the user query if it exists
      ...(options?.query ? [{ $match: { $jsonSchema: options.query } }] : []),
      // Group by webId and name and reduce to only the latest
      // version of each document
      {
        $sort: { lastModified: 1, tombstone: -1 },
      },
      {
        $group: {
          _id: { webId: "$webId", name: "$name" },
          value: { $last: "$value" },
          lastModified: { $last: "$lastModified" },
          acl: { $last: "$acl" },
          channels: { $last: "$channels" },
          tombstone: { $last: "$tombstone" },
        },
      },
      // Mask out the value if the object has been deleted
      // (ie tombstone is true) and fix the webId/name fields
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
          webId: "$_id.webId",
          name: "$_id.name",
          lastModified: 1,
          acl: 1,
          channels: 1,
        },
      },
      // Sort again after grouping
      {
        $sort: { lastModified: 1 },
      },
      // Add optional skip and limits
      ...(options?.skip ? [{ $skip: options.skip }] : []),
      ...(options?.limit ? [{ $limit: options.limit }] : []),
    ];

    try {
      for await (const doc of this.storeModel.aggregate(pipeline)) {
        yield doc;
      }
    } catch (e) {
      if (e.name === "MongoServerError") {
        throw new UnprocessableEntityException(e.message);
      } else {
        throw e;
      }
    }
  }
}
