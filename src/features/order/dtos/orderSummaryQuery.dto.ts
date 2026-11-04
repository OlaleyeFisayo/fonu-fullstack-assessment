import { IsISO8601, Matches } from "class-validator";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class OrderSummaryQueryDto {
  @Matches(DATE_ONLY, { message: "from must be in YYYY-MM-DD format" })
  @IsISO8601({ strict: true })
  from: string;

  @Matches(DATE_ONLY, { message: "to must be in YYYY-MM-DD format" })
  @IsISO8601({ strict: true })
  to: string;
}
