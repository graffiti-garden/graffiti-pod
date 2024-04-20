import { Module } from "@nestjs/common";
import { StoreModule } from "./store/store.module";
import { MongooseModule } from "@nestjs/mongoose";
import { DhtModule } from './dht/dht.module';

export const RootMongooseModule = MongooseModule.forRoot("mongodb://mongo");

@Module({
  imports: [StoreModule, RootMongooseModule, DhtModule],
})
export class AppModule {}
