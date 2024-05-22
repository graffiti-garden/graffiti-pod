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
import { InfoHash } from "../info-hash/info-hash";
import { QueryDTO } from "./stream.query.dto";
import { UseFilters, UsePipes, ValidationPipe } from "@nestjs/common";
import { WsValidationFilter } from "./stream.filter";
import { ListChannelsDTO } from "./stream.list-channels.dto";

@UsePipes(new ValidationPipe({ transform: true }))
@UseFilters(WsValidationFilter)
@WebSocketGateway()
export class StreamGateway implements OnGatewayConnection {
  constructor(
    private readonly streamRequestService: StreamRequestService,
    private readonly storeService: StoreService,
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

  private async handleIterator(
    id: string,
    socket: Socket,
    iterator: AsyncIterable<any>,
  ) {
    (async () => {
      for await (const result of iterator) {
        socket.emit(id, {
          type: "update",
          ...result,
        });
      }
      socket.emit(id, {
        type: "complete",
      });
    })();
  }

  @SubscribeMessage("ls")
  async handleListChannels(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: ListChannelsDTO,
  ): Promise<void> {
    const iterator = this.storeService.listChannels(
      socket.handshake.query.webId as string,
      {
        modifiedSince: dto.modifiedSince,
      },
    );

    this.handleIterator(dto.id, socket, iterator);
  }

  @SubscribeMessage("query")
  async handleSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: QueryDTO,
  ): Promise<void | WsResponse<any>> {
    const challenge = socket.handshake.query.challenge as string;
    for (const [index, infoHash] of dto.infoHashes.entries()) {
      if (!InfoHash.verifyInfoHashAndPok(infoHash, dto.poks[index])) {
        return {
          event: dto.id,
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
      { query: dto.query, limit: dto.limit, modifiedSince: dto.modifiedSince },
    );

    this.handleIterator(dto.id, socket, iterator);
  }
}
