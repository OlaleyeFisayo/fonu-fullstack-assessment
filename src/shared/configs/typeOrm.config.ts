import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import path from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { EnvConfigService, env } from "../env";

type DbOptionsPayload = {
  url: string;
};

export function dbOptions(payload: DbOptionsPayload): DataSourceOptions {
  return {
    type: "postgres",
    url: payload.url,
    synchronize: false,
    ssl: true,
    entities: [path.join(__dirname, "../../**/*.entity{.ts,.js}")],
    migrations: [path.join(__dirname, "../../migrations/*{.ts,.js}")],
  };
}

export default new DataSource(
  dbOptions({
    url: env.DB_URL,
  }),
);

export function typeOrmFactory(config: EnvConfigService): TypeOrmModuleOptions {
  return dbOptions({
    url: config.get("DB_URL"),
  });
}
