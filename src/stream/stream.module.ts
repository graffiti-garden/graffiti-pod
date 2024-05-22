import { Module } from "@nestjs/common";
import { StreamRequestModule } from "../stream-request/stream-request.module";
import { StoreModule } from "../store/store.module";
import { StreamGateway } from "./stream.gateway";

@Module({
  imports: [StreamRequestModule, StoreModule],
  providers: [StreamGateway],
})
export class StreamModule {}
