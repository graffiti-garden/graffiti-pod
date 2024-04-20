import { Module } from "@nestjs/common";
import { DhtService } from "./dht.service";
import { DhtController } from "./dht.controller";

@Module({
  providers: [DhtService],
  controllers: [DhtController],
})
export class DhtModule {}
