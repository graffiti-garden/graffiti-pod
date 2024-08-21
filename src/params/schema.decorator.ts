import { BadRequestException, PipeTransform, Query } from "@nestjs/common";

class DecodePipe implements PipeTransform {
  transform(value: any): any {
    if (typeof value === "string") {
      let query: any;
      try {
        query = JSON.parse(value);
      } catch (e) {
        throw new BadRequestException("Query is invalid JSON");
      }
      return query;
    }
    return undefined;
  }
}

export const Schema = () => Query("schema", new DecodePipe());
