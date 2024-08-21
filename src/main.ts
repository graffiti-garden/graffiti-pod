import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

const headers = [
  "Content-Type",
  "Authorization",
  "DPoP",
  "Acess-Control-List",
  "Channels",
  "Last-Modified",
  "If-Modified-Since",
  "Range",
  "Cache-Control",
  "Vary",
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
