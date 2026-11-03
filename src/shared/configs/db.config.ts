import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { EnvConfigService } from "../env";
import { dbOptions } from "./typeOrm.config";

export function dbFactory(config: EnvConfigService): TypeOrmModuleOptions {
  return dbOptions({
    url: config.get("DB_URL"),
  });
}
