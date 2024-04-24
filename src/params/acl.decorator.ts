import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";

export const AccessControlList = createParamDecorator(
  (_, ctx: ExecutionContext): string[] | null => {
    const request = ctx.switchToHttp().getRequest() as IncomingMessage;
    if (
      "access-control-list" in request.headers &&
      request.headers["access-control-list"]
    ) {
      if (Array.isArray(request.headers["access-control-list"])) {
        return request.headers["access-control-list"];
      } else {
        return [request.headers["access-control-list"]];
      }
    } else {
      return null;
    }
  },
);
