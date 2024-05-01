import {
  IsNotEmpty,
  IsArray,
  Matches,
  MaxLength,
  IsNumber,
  IsObject,
  IsOptional,
  IsDate,
} from "class-validator";
import { Type } from "class-transformer";
import { JSONSchema4 } from "json-schema";

export class QueryDTO {
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @IsArray()
  @Matches(/^[0-9a-fA-F]{64}$/, { each: true })
  infoHashes: string[];

  @IsArray()
  @Matches(/^[0-9a-fA-F]{128}$/, { each: true })
  poks: string[];

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsObject()
  query?: JSONSchema4;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  modifiedSince?: Date;
}
