import { ColumnOptions } from "typeorm";

export const moneyColumn: ColumnOptions = {
  type: "numeric",
  precision: 12,
  scale: 2,
  transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
};
