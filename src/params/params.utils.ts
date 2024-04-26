import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";

export function encodeHeaderArray(headerArray: string[]): string {
  return headerArray.map(encodeURIComponent).join(",");
}

export function decodeHeaderArray(headerString: string): string[] {
  return headerString.split(",").map(decodeURIComponent);
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
