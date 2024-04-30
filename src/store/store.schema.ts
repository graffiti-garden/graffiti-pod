import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { MongooseModule } from "@nestjs/mongoose";

export type StoreDocument = HydratedDocument<StoreSchema>;

function uniqueStringArrayValidator(v: any) {
  return (
    Array.isArray(v) &&
    v.every((e) => typeof e === "string") &&
    new Set(v).size === v.length
  );
}

@Schema({
  optimisticConcurrency: true,
  minimize: false,
  timestamps: {
    createdAt: false,
    updatedAt: "lastModified",
  },
})
export class StoreSchema {
  lastModified: Date;

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
      validator: uniqueStringArrayValidator,
      message: "Channels must be a unique array of strings.",
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
          uniqueStringArrayValidator(v) &&
          v.length === this.channels.length &&
          v.every((s: string) => /^[0-9a-fA-F]{64}$/.test(s))
        );
      },
      message:
        "Info hashes must be a unique array of hex strings, one for each channel.",
    },
  })
  infoHashes: string[];

  @Prop({
    type: [String],
    required: false,
    default: undefined,
    validate: {
      validator: uniqueStringArrayValidator,
      message: "ACL must be a unique array of strings.",
    },
  })
  acl?: string[];
}

export const StoreMongooseSchema = SchemaFactory.createForClass(StoreSchema);

export const StoreMongooseModule = MongooseModule.forFeature([
  { name: StoreSchema.name, schema: StoreMongooseSchema },
]);
