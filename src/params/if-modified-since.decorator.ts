import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";
import { parseDateString } from "./params.utils";

export const IfModifiedSince = createParamDecorator(
  (_, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest() as IncomingMessage;
    return parseDateString(request.headers["if-modified-since"]);
  },
);
