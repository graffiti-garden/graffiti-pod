import { Param, PipeTransform } from "@nestjs/common";

export class DecodePipe implements PipeTransform {
  transform(value: any) {
    return decodeURIComponent(value);
  }
}

export const DecodeParam = (param: string) => Param(param, new DecodePipe());
