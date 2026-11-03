import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ data: null, message: "Internal server error", status: false });
    }

    const body = exception.getResponse();
    const raw =
      typeof body === "string"
        ? body
        : (body as { message?: string | string[] }).message;
    const message = Array.isArray(raw)
      ? raw.join(", ")
      : (raw ?? exception.message);

    res
      .status(exception.getStatus())
      .json({ data: null, message, status: false });
  }
}
