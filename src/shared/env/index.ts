import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import { validateEnv } from "type-envgen";
import { z } from "zod";

if (existsSync(".env")) process.loadEnvFile();

export const envSchema = z.object({
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  DB_URL: z.url(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
});

export const env = validateEnv(envSchema, process.env);
export type Env = z.infer<typeof envSchema>;
export type EnvConfigService = ConfigService<Env, true>;
