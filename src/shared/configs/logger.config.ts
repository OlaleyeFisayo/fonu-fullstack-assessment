import type { Request, Response } from "express";
import type { Params } from "nestjs-pino";
import { env } from "../env";

const IGNORED_PATHS = ["/", "/health", "/docs-json", "/favicon.ico"];
const SLOW_MS = 1000;

const message = (req: Request, res: Response) =>
  `${req.method} ${req.url} ${res.statusCode}`;

const logObject = (
  res: Response,
  { err: _err, ...val }: { err?: unknown; responseTime: number },
) => ({
  ...val,
  ...(res.locals.errorMessage && { errorMessage: res.locals.errorMessage }),
  ...(val.responseTime > SLOW_MS && { slow: true }),
});

export const loggerConfig: Params<Request, Response> = {
  pinoHttp: {
    transport:
      env.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { singleLine: true } },
    autoLogging: {
      ignore: (req) => {
        const path = req.url.split("?")[0];
        return IGNORED_PATHS.includes(path) || path.startsWith("/swagger-ui");
      },
    },
    serializers: {
      req: (req: { method: string; url: string }) => ({
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: message,
    customErrorMessage: message,
    customSuccessObject: (_req, res, val) => logObject(res, val),
    customErrorObject: (_req, res, _err, val) => logObject(res, val),
  },
};
