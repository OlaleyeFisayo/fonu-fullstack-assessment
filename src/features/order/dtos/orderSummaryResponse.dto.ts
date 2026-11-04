import { OrderStatus } from "../entities/order.entity";

export class OrderStatusCountDto {
  status: OrderStatus;
  count: number;
  revenue: string;
}

export class TopProductDto {
  productName: string;
  quantity: number;
}

export class OrderSummaryResponseDto {
  from: string;
  to: string;
  totalOrders: number;
  revenue: string;
  byStatus: OrderStatusCountDto[];
  topProducts: TopProductDto[];
}
