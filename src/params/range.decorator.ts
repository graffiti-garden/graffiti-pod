import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "http";
import { rangeToSkipLimit } from "./params.utils";

export const Range = createParamDecorator((_, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest() as IncomingMessage;
  return rangeToSkipLimit(request.headers["range"]);
});
