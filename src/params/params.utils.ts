import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";

export function encodeHeaderArray(headerArray: string[]): string {
  return headerArray.map(encodeURIComponent).join(",");
}

export function decodeHeaderArray(headerString: string): string[] {
  return headerString
    .split(",")
    .filter((s) => s)
    .map(decodeURIComponent);
}

export function headerArrayDecorator<T>(name: string, default_: T) {
  return createParamDecorator((_, ctx: ExecutionContext): string[] | T => {
    const request = ctx.switchToHttp().getRequest() as IncomingMessage;
    if (name in request.headers) {
      const header = request.headers[name];
      if (typeof header === "string") {
        return decodeHeaderArray(header);
      }
    }
    return default_;
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
