import type { INestApplication } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AllExceptionsFilter } from "../filters/allExceptions.filter";
import { ResponseInterceptor } from "../interceptors/response.interceptor";

export function setupGlobalResponse(app: INestApplication) {
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new AllExceptionsFilter());
}
