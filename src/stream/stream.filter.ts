import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from "@nestjs/common";

@Catch(BadRequestException)
export class WsValidationFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const response = exception.getResponse() as BadRequestException;
    const message = response.message;
    const messageObject = {
      type: "error",
      message,
    };

    const wsArgs = host.switchToWs();
    const client = wsArgs.getClient();
    const pattern = wsArgs.getPattern();
    const data = wsArgs.getData();

    if (typeof data === "object" && "id" in data) {
      client.emit(data.id, messageObject);
    } else {
      client.emit(pattern, messageObject);
    }
  }
}
