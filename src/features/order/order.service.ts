import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaginationQueryDto } from "../../shared/dtos/paginationQuery.dto";
import { pageOptions, paginate } from "../../shared/utils/paginate";
import { toDto } from "../../shared/utils/toDto";
import { OrderResponseDto } from "./dtos/orderResponse.dto";
import { Order } from "./entities/order.entity";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
  ) {}

  async listOrders(query: PaginationQueryDto) {
    const [orders, total] = await this.orderRepo.findAndCount({
      relations: { items: true },
      order: { createdAt: "DESC" },
      ...pageOptions(query),
    });

    return paginate(toDto(OrderResponseDto, orders), total, query);
  }
}
