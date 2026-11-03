import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import metadata from "../../metadata";

export async function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("Fonu Assessment API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  await SwaggerModule.loadPluginMetadata(metadata);
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("/", app, document, { jsonDocumentUrl: "docs-json" });
}
