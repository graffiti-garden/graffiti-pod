import {
  BadRequestException,
  type PipeTransform,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";

class DecodePipe implements PipeTransform {
  transform(value: any): {} {
    if (!value) {
      return {};
    } else if (typeof value === "string") {
      let schema: unknown;
      try {
        schema = JSON.parse(value);
      } catch (e) {
        throw new UnprocessableEntityException(
          "InvalidSchema: Schema is invalid JSON",
        );
      }
      if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        throw new UnprocessableEntityException(
          "InvalidSchema: Schema is not an object",
        );
      }
      return schema;
    } else {
      throw new UnprocessableEntityException(
        "InvalidSchema: Schema not understood",
      );
    }
  }
}

export const Schema = () => Query("schema", new DecodePipe());
