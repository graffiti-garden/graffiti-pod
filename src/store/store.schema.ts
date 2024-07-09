import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { MongooseModule } from "@nestjs/mongoose";

export type StoreDocument = HydratedDocument<StoreSchema>;

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
    type: [String],
    required: true,
    default: undefined,
    validate: {
      validator: (v: any) =>
        Array.isArray(v) &&
        v.every((e) => typeof e === "string") &&
        new Set(v).size === v.length,
      message: "Channels must be a unique array of strings.",
    },
  })
  channels: string[];

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
