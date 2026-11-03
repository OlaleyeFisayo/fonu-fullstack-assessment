import { OmitType } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { Order, OrderStatus } from "../entities/order.entity";
import { OrderCustomerDto } from "./orderCustomer.dto";
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

  // absent unless the customer relation was loaded
  @Expose()
  @Type(() => OrderCustomerDto)
  customer?: OrderCustomerDto;
}
