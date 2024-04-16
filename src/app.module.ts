import { Module } from "@nestjs/common";
import { StoreModule } from "./store/store.module";
import { MongooseModule } from "@nestjs/mongoose";

export const RootMongooseModule = MongooseModule.forRoot("mongodb://mongo");

@Module({
  imports: [StoreModule, RootMongooseModule],
})
export class AppModule {}
