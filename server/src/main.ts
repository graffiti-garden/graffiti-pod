import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

const headers = [
  "Content-Type",
  "Authorization",
  "DPoP",
  "Allowed",
  "Channels",
  "Last-Modified",
  "Last-Modified-Ms",
  "Cache-Control",
  "Vary",
  "A-IM",
  "IM",
];

async function bootstrap() {
  const fastify = new FastifyAdapter();
  fastify.enableCors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    allowedHeaders: headers,
    exposedHeaders: headers,
    maxAge: 3600, // 1 hour
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastify,
  );
  await app.listen(3000, "0.0.0.0");
}
bootstrap();
