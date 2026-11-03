import { ConfigService } from "@nestjs/config";
import { existsSync } from "fs";
import { validateEnv } from "type-envgen";
import { z } from "zod";

if (existsSync(".env")) process.loadEnvFile();

export const envSchema = z.object({
  DB_URL: z.url(),
});

export const env = validateEnv(envSchema, process.env);
export type Env = z.infer<typeof envSchema>;
export type EnvConfigService = ConfigService<Env, true>;
