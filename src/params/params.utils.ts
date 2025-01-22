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
