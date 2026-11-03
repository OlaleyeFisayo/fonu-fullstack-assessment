import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { setupGlobalResponse } from "./shared/configs/globalResponse.config";
import { setupGlobalTransformerPipe } from "./shared/configs/globalTransformerPipe.config";
import { setupSwagger } from "./shared/configs/swagger.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  setupGlobalTransformerPipe(app);
  setupGlobalResponse(app);
  await setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
