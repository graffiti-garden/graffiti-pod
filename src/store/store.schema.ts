import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { MongooseModule } from "@nestjs/mongoose";
import { InfoHash } from "../info-hash/info-hash";

export type StoreDocument = HydratedDocument<StoreSchema>;

@Schema({
  validateBeforeSave: true,
  _id: false,
})
class ChannelSchema {
  @Prop({ required: true })
  value: string;

  @Prop({
    required: true,
    validate: {
      validator: (s: string) => /^[0-9a-fA-F]{64}$/.test(s),
      message:
        "Info hashes must be a unique array of hex strings, one for each channel.",
    },
  })
  infoHash: string;
}

export function channelsToChannelSchema(channels: string[]): ChannelSchema[] {
  return channels.map<ChannelSchema>((value) => ({
    value,
    infoHash: InfoHash.toInfoHash(value),
  }));
}

export function channelSchemaToChannels(
  channelSchemas: ChannelSchema[],
): string[] {
  return channelSchemas.map<string>((channelSchema) => channelSchema.value);
}

@Schema({
  minimize: false,
  timestamps: {
    createdAt: false,
    updatedAt: "lastModified",
  },
  validateBeforeSave: true,
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
    validate: {
      validator: (v: any) =>
        typeof v === "object" && !Array.isArray(v) && v !== null,
      message: "Value must be an object.",
    },
  })
  value: Object;

  @Prop({
    type: [ChannelSchema],
    required: true,
    default: undefined,
    validate: {
      validator: (v: any) =>
        Array.isArray(v) &&
        new Set(channelSchemaToChannels(v)).size === v.length,
      message: "Channels must unique.",
    },
  })
  channels: ChannelSchema[];

  @Prop({
    type: [String],
    required: false,
    default: undefined,
    validate: {
      validator: (v: any) =>
        Array.isArray(v) &&
        v.every((e) => typeof e === "string") &&
        new Set(v).size === v.length,
      message: "ACL must be a unique array of strings.",
    },
  })
  acl?: string[];

  @Prop({
    type: Boolean,
    default: false,
  })
  tombstone: boolean;
}

export const StoreMongooseSchema = SchemaFactory.createForClass(StoreSchema);

export const StoreMongooseModule = MongooseModule.forFeature([
  { name: StoreSchema.name, schema: StoreMongooseSchema },
]);
