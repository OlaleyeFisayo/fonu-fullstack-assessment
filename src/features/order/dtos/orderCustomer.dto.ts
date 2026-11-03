import { Expose } from "class-transformer";

// only safe fields; password and hashedRefreshToken are never exposed
export class OrderCustomerDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() email: string;
}
