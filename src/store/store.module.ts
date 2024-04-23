import { Module } from "@nestjs/common";
import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";
import { StoreMongooseModule } from "./store.schema";
import { InfoHashService } from "../info-hash/info-hash.service";

@Module({
  imports: [StoreMongooseModule],
  controllers: [StoreController],
  providers: [StoreService, InfoHashService],
})
export class StoreModule {}
