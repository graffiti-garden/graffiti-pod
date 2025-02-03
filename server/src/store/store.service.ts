import {
  UnauthorizedException,
  UnprocessableEntityException,
  PreconditionFailedException,
  ForbiddenException,
  NotFoundException,
  StreamableFile,
  InternalServerErrorException,
} from "@nestjs/common";
import { Readable } from "stream";
import type { FastifyReply } from "fastify";
import { encodeURIArray } from "../params/params.utils";
import {
  GraffitiErrorForbidden,
  GraffitiErrorInvalidSchema,
  GraffitiErrorNotFound,
  GraffitiErrorPatchError,
  GraffitiErrorPatchTestFailed,
  GraffitiErrorSchemaMismatch,
  GraffitiErrorUnauthorized,
  type GraffitiObjectBase,
  type GraffitiStream,
} from "@graffiti-garden/api";

export class StoreService {
  validateActor(targetActor: string | null, selfActor: string | null) {
    if (!selfActor) {
      throw new UnauthorizedException(
        "You must be logged in to access this resource.",
      );
    }
    if (targetActor !== selfActor) {
      throw new ForbiddenException("You are not the owner of this resource.");
    }
  }

  catchGraffitiError(error: unknown) {
    if (error instanceof GraffitiErrorNotFound) {
      return new NotFoundException(error.message);
    } else if (error instanceof GraffitiErrorPatchError) {
      return new UnprocessableEntityException("PatchError: " + error.message);
    } else if (error instanceof GraffitiErrorPatchTestFailed) {
      return new PreconditionFailedException(
        "PatchTestFailed: " + error.message,
      );
    } else if (error instanceof GraffitiErrorForbidden) {
      return new ForbiddenException(error.message);
    } else if (error instanceof GraffitiErrorUnauthorized) {
      return new UnauthorizedException(error.message);
    } else if (error instanceof GraffitiErrorInvalidSchema) {
      return new UnprocessableEntityException(
        "InvalidSchema: " + error.message,
      );
    } else if (error instanceof GraffitiErrorSchemaMismatch) {
      return new PreconditionFailedException(
        "SchemaMismatch: " + error.message,
      );
    } else {
      return new InternalServerErrorException(error);
    }
  }

  returnObject(
    object: GraffitiObjectBase,
    response: FastifyReply,
    type: "put" | "get" | "patch" | "delete",
  ): Object | void {
    // If putting and the previous object is blank issue "201: Created"
    if (
      type === "put" &&
      Object.keys(object.value).length === 0 &&
      object.channels.length === 0 &&
      object.allowed === undefined
    ) {
      response.status(201);
    } else if (type === "get" && object.tombstone === true) {
      response.status(410);
    } else {
      response.status(200);
    }

    if (object.allowed) {
      response.header("allowed", encodeURIArray(object.allowed));
    }
    if (object.channels.length) {
      response.header("channels", encodeURIArray(object.channels));
    }
    const lastModifiedDate = new Date(object.lastModified);
    response.header("last-modified", lastModifiedDate.toUTCString());
    // Send milliseconds too to avoid rounding errors
    response.header(
      "last-modified-ms",
      lastModifiedDate.getUTCMilliseconds().toString(),
    );

    return object.value;
  }

  async iteratorToStreamableFile<T, S>(
    iterator: GraffitiStream<T, S>,
    response: FastifyReply,
  ): Promise<StreamableFile> {
    let firstResult = await iterator.next();
    if (firstResult.done) {
      response.status(204);
    } else {
      response.status(200);
    }

    const byteIterator = (async function* () {
      if (firstResult.done) return;
      if (!firstResult.value.error) {
        yield Buffer.from(JSON.stringify(firstResult.value.value));
      }
      for await (const object of iterator) {
        if (object.error) continue;
        yield Buffer.from("\n");
        yield Buffer.from(JSON.stringify(object.value));
      }
    })();
    const stream = Readable.from(byteIterator);
    return new StreamableFile(stream, {
      type: "text/plain",
    });
  }
}
