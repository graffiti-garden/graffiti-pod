import { Module } from "@nestjs/common";
import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";
import { GraffitiObjectMongooseModule } from "../schemas/object.schema";

@Module({
  imports: [GraffitiObjectMongooseModule],
  controllers: [StoreController],
  providers: [StoreService],
})
export class StoreModule {}
