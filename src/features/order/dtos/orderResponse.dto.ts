import { OmitType } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { Order, OrderStatus } from "../entities/order.entity";
import { OrderItemResponseDto } from "./orderItemResponse.dto";

export class OrderResponseDto extends OmitType(Order, ["customer", "items"]) {
  @Expose() id: string;
  @Expose() status: OrderStatus;
  @Expose() total: number;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;

  @Expose()
  @Type(() => OrderItemResponseDto)
  items: OrderItemResponseDto[];
}
