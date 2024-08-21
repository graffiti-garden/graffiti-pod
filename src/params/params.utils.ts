import { BadRequestException, createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";

export function encodeURIArray(headerArray: string[]): string {
  return headerArray.map(encodeURIComponent).join(",");
}

export function decodeURIArray(headerString: string): string[] {
  return headerString
    .split(",")
    .filter((s) => s)
    .map(decodeURIComponent);
}

export function parseQueryParamFromPath(
  name: string,
  path: string | undefined,
): string | undefined {
  return path
    ?.split("?")[1]
    ?.split("&")
    .find((p) => p.startsWith(name + "="))
    ?.split("=")[1];
}

export function queryArrayDecorator<T>(name: string, default_: T) {
  return createParamDecorator((_, ctx: ExecutionContext): string[] | T => {
    const request = ctx.switchToHttp().getRequest() as IncomingMessage;
    const param = parseQueryParamFromPath(name, request.url);
    return typeof param === "string" ? decodeURIArray(param) : default_;
  });
}

export function rangeToSkipLimit(range: string | undefined): {
  skip?: number;
  limit?: number;
} {
  if (!range) return {};

  const value = range.split("=");
  if (value.length < 2) return {};

  const [start, end] = value[1].split("-");
  let skip: number | undefined = parseInt(start, 10);
  skip = isNaN(skip) ? undefined : skip;
  let limit: number | undefined = parseInt(end, 10) - (skip ?? 0) + 1;
  limit = isNaN(limit) ? undefined : limit;

  return { skip, limit };
}

export function parseDateString(dateString?: string): Date | undefined {
  const date = dateString ? new Date(dateString) : undefined;
  if (date && isNaN(date.getTime())) {
    throw new BadRequestException("Invalid date format.");
  }
  return date;
}
