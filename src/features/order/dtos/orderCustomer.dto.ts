import { Expose } from "class-transformer";

export class OrderCustomerDto {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() email: string;
}
