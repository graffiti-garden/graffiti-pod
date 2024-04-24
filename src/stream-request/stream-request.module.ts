import { Module } from "@nestjs/common";
import { StreamRequestService } from "./stream-request.service";
import { StreamRequestController } from "./stream-request.controller";
import { StreamRequestMongooseModule } from "./stream-request.schema";

@Module({
  imports: [StreamRequestMongooseModule],
  providers: [StreamRequestService],
  controllers: [StreamRequestController],
  exports: [StreamRequestService],
})
export class StreamRequestModule {}
