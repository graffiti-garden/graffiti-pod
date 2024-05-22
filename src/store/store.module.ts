import { Module } from "@nestjs/common";
import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";
import { StoreMongooseModule } from "./store.schema";

@Module({
  imports: [StoreMongooseModule],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule {}
