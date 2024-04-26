import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  WsResponse,
} from "@nestjs/websockets";
import { Socket } from "socket.io";
import { StreamRequestService } from "../stream-request/stream-request.service";
import { StoreService } from "../store/store.service";
import { InfoHashService } from "../info-hash/info-hash.service";
import { QueryDTO } from "./stream.query.dto";
import { UseFilters, UsePipes, ValidationPipe } from "@nestjs/common";
import { WsValidationFilter } from "./stream.filter";

@UseFilters(WsValidationFilter)
@WebSocketGateway()
export class StreamGateway implements OnGatewayConnection {
  constructor(
    private readonly streamRequestService: StreamRequestService,
    private readonly storeService: StoreService,
    private readonly infoHashService: InfoHashService,
  ) {}

  async handleConnection(socket: Socket) {
    const { webId, challenge } = socket.handshake.query;
    if (
      !webId ||
      !challenge ||
      typeof webId !== "string" ||
      typeof challenge !== "string"
    ) {
      socket.emit("initialize", {
        type: "error",
        message: "Invalid request",
      });
      return socket.disconnect();
    }

    const verified = await this.streamRequestService.verifyRequest(
      webId,
      challenge,
    );
    if (!verified) {
      socket.emit("initialize", {
        type: "error",
        message: "Request verification failed",
      });
      return socket.disconnect();
    }

    socket.emit("initialize", {
      type: "success",
      message: "Request verified, welcome 🎨",
    });
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage("query")
  async handleSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: QueryDTO,
  ): Promise<void | WsResponse<any>> {
    const event = `query:${dto.id}`;

    const challenge = socket.handshake.query.challenge as string;
    for (const [index, infoHash] of dto.infoHashes.entries()) {
      if (
        !this.infoHashService.verifyInfoHashAndPok(
          infoHash,
          dto.poks[index],
          challenge,
        )
      ) {
        return {
          event,
          data: {
            type: "error",
            message: "Invalid proof of knowledge",
          },
        };
      }
    }

    // Initialize the query
    const iterator = this.storeService.queryObjects(
      dto.infoHashes,
      socket.handshake.query.webId as string,
      { query: dto.query, limit: dto.limit },
    );

    // Send responses to the client in the background
    (async () => {
      for await (const object of iterator) {
        socket.emit(event, {
          type: "update",
          data: object,
        });
      }
      socket.emit(event, {
        type: "complete",
      });
    })();
  }
}
