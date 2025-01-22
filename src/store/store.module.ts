import "dotenv/config";
import { Module } from "@nestjs/common";
import { StoreController } from "./store.controller";
import { StoreService } from "./store.service";
import type { GraffitiPouchDBOptions } from "@graffiti-garden/implementation-pouchdb";

@Module({
  controllers: [StoreController],
  exports: [StoreService],
  providers: [
    StoreService,
    {
      provide: "GRAFFITI_POUCHDB_OPTIONS",
      useValue: {
        sourceName: "https://" + process.env.DOMAIN,
        pouchDBOptions: {},
      } satisfies GraffitiPouchDBOptions,
    },
  ],
})
export class StoreModule {}
