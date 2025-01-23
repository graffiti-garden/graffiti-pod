import { Module } from "@nestjs/common";
import { StoreModule } from "./store/store.module";

@Module({
  imports: [StoreModule],
})
export class AppModule {}
