import { Controller, Post } from "@nestjs/common";
import { StreamRequestService } from "./stream-request.service";
import { WebId } from "../params/webid.decorator";

@Controller("w")
export class StreamRequestController {
  constructor(private readonly streamRequestService: StreamRequestService) {}

  @Post()
  async makeRequest(@WebId() webId: string) {
    return this.streamRequestService.makeRequest(webId);
  }
}
