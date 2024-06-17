import { createSolidTokenVerifier } from "@solid/access-token-verifier";
import type {
  RequestMethod,
  SolidAccessTokenPayload,
} from "@solid/access-token-verifier";
import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { IncomingMessage } from "http";

const verify = createSolidTokenVerifier();

export const WebId = createParamDecorator(
  async (_, ctx: ExecutionContext): Promise<string | null> => {
    const request = ctx.switchToHttp().getRequest() as IncomingMessage;

    const {
      url,
      socket,
      headers: { authorization, dpop, host },
    } = request;

    // An unauthenticated request
    if (!authorization || !dpop || typeof dpop !== "string") {
      return null;
    }

    const method = request.method as RequestMethod;
    const protocol =
      "x-forwarded-proto" in request.headers
        ? request.headers["x-forwarded-proto"]
        : "encrypted" in socket
          ? "https"
          : "http";
    const urlComplete = `${protocol}://${host}${url}`;

    let payload: SolidAccessTokenPayload;
    try {
      payload = await verify(authorization, {
        header: dpop,
        method,
        url: urlComplete,
      });
    } catch (e) {
      throw new UnauthorizedException(e);
    }

    return payload.webid;
  },
);
