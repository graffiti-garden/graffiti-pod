import { Type } from "class-transformer";
import { IsOptional, IsDate, IsNotEmpty, MaxLength } from "class-validator";

export class ListChannelsDTO {
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  modifiedSince?: Date;
}
