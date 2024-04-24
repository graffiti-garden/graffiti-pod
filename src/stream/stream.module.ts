import { Module } from "@nestjs/common";
import { StreamRequestModule } from "../stream-request/stream-request.module";
import { StoreModule } from "../store/store.module";
import { InfoHashService } from "../info-hash/info-hash.service";
import { StreamGateway } from "./stream.gateway";

@Module({
  imports: [StreamRequestModule, StoreModule],
  providers: [InfoHashService, StreamGateway],
})
export class StreamModule {}
