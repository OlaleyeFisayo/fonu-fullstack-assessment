import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { map } from "rxjs";
import { ResponseMessage } from "../decorators/response.decorator";

export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const message =
      this.reflector.get(ResponseMessage, context.getHandler()) ?? "Successful";
    return next
      .handle()
      .pipe(
        map((data) => ({ ...(data ? { data } : {}), message, status: true })),
      );
  }
}
