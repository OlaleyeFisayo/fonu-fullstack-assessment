import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { setupGlobalResponse } from "./../src/shared/configs/globalResponse.config";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupGlobalResponse(app);
    await app.init();
  });

  it("/health (GET)", () => {
    return request(app.getHttpServer()).get("/health").expect(200).expect({
      data: "server is running",
      message: "Successful",
      status: true,
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
