import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { MongooseModule } from "@nestjs/mongoose";

export type GraffitiObjectDocument = HydratedDocument<GraffitiObject>;

function stringArraySchema(name: string, required = false) {
  return {
    type: [String],
    required,
    default: undefined,
    validate: {
      validator: (v) =>
        Array.isArray(v) && v.every((e) => typeof e === "string"),
      message: `${name} must be an array of strings.`,
    },
  };
}

@Schema({
  optimisticConcurrency: true,
})
export class GraffitiObject {
  @Prop({ required: true })
  webId: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    required: true,
    type: {},
    validate: [
      (v) => typeof v === "object" && !Array.isArray(v) && v !== null,
      "Value must be an object.",
    ],
  })
  value: Object;

  @Prop(stringArraySchema("Channels", true))
  channels: string[];

  @Prop(stringArraySchema("ACL", false))
  acl: string[];
}

export const GraffitiObjectSchema =
  SchemaFactory.createForClass(GraffitiObject);

export const GraffitiObjectMongooseModule = MongooseModule.forFeature([
  { name: GraffitiObject.name, schema: GraffitiObjectSchema },
]);
