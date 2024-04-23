import { SchemaFactory, Schema, Prop } from "@nestjs/mongoose";
import { MongooseModule } from "@nestjs/mongoose";

@Schema()
export class StreamRequest {
  @Prop({ required: true })
  challenge: string;

  @Prop({ required: true })
  webId: string;

  @Prop({ required: true })
  createdAt: Date;
}

export const StreamRequestSchema = SchemaFactory.createForClass(StreamRequest);

export const StreamRequestMongooseModule = MongooseModule.forFeature([
  { name: StreamRequest.name, schema: StreamRequestSchema },
]);
