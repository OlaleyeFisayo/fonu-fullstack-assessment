import { DataSource } from "typeorm";
import { env } from "../env";
import { dbOptions } from "./dbOptions";

export default new DataSource(
  dbOptions({
    url: env.DB_URL,
  }),
);
