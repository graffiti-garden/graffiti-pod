import { Module } from "@nestjs/common";
import { StoreModule } from "./store/store.module";
import { MongooseModule } from "@nestjs/mongoose";
import { DhtModule } from "./dht/dht.module";
// import { StreamGateway } from "./stream/stream.gateway";
import { StreamRequestModule } from "./stream-request/stream-request.module";
import { ScheduleModule } from "@nestjs/schedule";

export const RootMongooseModule = MongooseModule.forRoot("mongodb://mongo");

@Module({
  imports: [
    StoreModule,
    RootMongooseModule,
    DhtModule,
    StreamRequestModule,
    ScheduleModule.forRoot(),
  ],
  // providers: [StreamGateway],
})
export class AppModule {}
