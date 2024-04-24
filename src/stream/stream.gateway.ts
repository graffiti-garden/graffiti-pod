import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import { Socket } from "socket.io";
import { StreamRequestService } from "../stream-request/stream-request.service";

@WebSocketGateway()
export class StreamGateway {
  constructor(private readonly streamRequestService: StreamRequestService) {}

  async watch() {}

  async handleConnection(socket: Socket) {
    const { webId, challenge } = socket.handshake.query;
    if (
      !webId ||
      !challenge ||
      typeof webId !== "string" ||
      typeof challenge !== "string"
    ) {
      socket.emit("error", "Invalid request");
      return socket.disconnect();
    }

    if (!this.streamRequestService.verifyRequest(webId, challenge)) {
      socket.emit("error", "Request verification failed");
      return socket.disconnect();
    }

    //
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(
    @MessageBody() channels: string[],
    @ConnectedSocket() client: Socket,
  ) {
    // Subscribe to channels
    return "Hello world!";
  }

  @SubscribeMessage("unsubscribe")
  handleUnsubscribe(
    @MessageBody() channels: string[],
    @ConnectedSocket() client: Socket,
  ) {
    client.handshake.query.webId;
  }
}
