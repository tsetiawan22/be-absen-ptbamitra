import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = Number(process.env.BACKEND_PORT) || 3000;
  await app.listen(port);
  console.log(`Backend jalan di :${port}`);
}

bootstrap();
