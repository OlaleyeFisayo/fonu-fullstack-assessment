import { OmitType } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { OrderItem } from "../entities/orderItem.entity";

export class OrderItemResponseDto extends OmitType(OrderItem, [
  "order",
  "product",
]) {
  @Expose() id: string;
  @Expose() productName: string;
  @Expose() unitPrice: number;
  @Expose() quantity: number;
}
