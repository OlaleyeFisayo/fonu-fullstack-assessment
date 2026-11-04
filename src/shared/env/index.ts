import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import { z } from "zod";
import { validateEnv } from "type-envgen";

if (existsSync(".env")) process.loadEnvFile();

export const envSchema = z.object({
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  ADMIN_EMAIL: z.email(),
  ADMIN_NAME: z.string(),
  ADMIN_PASSWORD: z.string(),
  DB_URL: z.url(),
  NODE_ENV: z.enum(["development","staging","production"]),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  REPORTING_PORT: z.coerce.number().int(),
  REPORTING_TOKEN: z.string(),
  REPORTING_URL: z.string(),
});

export const env = validateEnv(envSchema, process.env);
export type Env = z.infer<typeof envSchema>;
export type EnvConfigService = ConfigService<Env, true>;
