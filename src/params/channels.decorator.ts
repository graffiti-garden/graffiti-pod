import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";

export const Channels = createParamDecorator(
  (_, ctx: ExecutionContext): string[] => {
    const request = ctx.switchToHttp().getRequest() as IncomingMessage;
    if ("channels" in request.headers) {
      if (Array.isArray(request.headers.channels)) {
        return request.headers.channels;
      } else {
        return [request.headers.channels];
      }
    } else {
      return [];
    }
  },
);
