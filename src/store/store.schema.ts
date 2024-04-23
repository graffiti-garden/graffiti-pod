import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { MongooseModule } from "@nestjs/mongoose";

export type StoreDocument = HydratedDocument<StoreSchema>;

function stringArrayValidator(v: any) {
  return Array.isArray(v) && v.every((e) => typeof e === "string");
}

@Schema({
  optimisticConcurrency: true,
})
export class StoreSchema {
  @Prop({ required: true })
  webId: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    type: {},
    validate: [
      (v: any) => typeof v === "object" && !Array.isArray(v) && v !== null,
      "Value must be an object.",
    ],
  })
  value: Object;

  @Prop({
    type: [String],
    required: true,
    default: undefined,
    validate: {
      validator: stringArrayValidator,
      message: "Channels must be an array of strings.",
    },
  })
  channels: string[];

  @Prop({
    type: [String],
    required: true,
    default: undefined,
    validate: {
      validator: function (v: any) {
        return (
          stringArrayValidator(v) &&
          v.length === this.channels.length &&
          v.every((s: string) => /^[0-9a-fA-F]{64}$/.test(s))
        );
      },
      message:
        "Info hashes must be an array of hex strings, one for each channel.",
    },
  })
  infoHashes: string[];

  @Prop({
    type: [String],
    required: false,
    default: undefined,
    validate: {
      validator: stringArrayValidator,
      message: "ACL must be an array of strings.",
    },
  })
  acl: string[];
}

export const StoreMongooseSchema = SchemaFactory.createForClass(StoreSchema);

export const StoreMongooseModule = MongooseModule.forFeature([
  { name: StoreSchema.name, schema: StoreMongooseSchema },
]);
