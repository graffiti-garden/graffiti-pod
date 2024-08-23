import { Module } from "@nestjs/common";
import { StoreModule } from "./store/store.module";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";

export const RootMongooseModule = MongooseModule.forRoot("mongodb://mongo");

@Module({
  imports: [StoreModule, RootMongooseModule, ScheduleModule.forRoot()],
})
export class AppModule {}
