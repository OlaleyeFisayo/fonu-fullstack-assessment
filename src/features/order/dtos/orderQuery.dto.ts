import { IsEnum, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../shared/dtos/paginationQuery.dto";
import { OrderStatus } from "../entities/order.entity";

export class OrderQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
