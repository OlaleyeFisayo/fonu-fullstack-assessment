import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from "typeorm";
import { JwtPayload } from "../../shared/types";
import { pageOptions, paginate } from "../../shared/utils/paginate";
import { toDto } from "../../shared/utils/toDto";
import { Product } from "../product/entities/product.entity";
import { UserRole } from "../user/entities/user.entity";
import { OrderQueryDto } from "./dtos/orderQuery.dto";
import { OrderResponseDto } from "./dtos/orderResponse.dto";
import { UpdateOrderStatusDto } from "./dtos/updateOrderStatus.dto";
import { Order, OrderStatus } from "./entities/order.entity";

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  private scope(user: JwtPayload): FindOptionsWhere<Order> {
    return user.role === UserRole.ADMIN
      ? {}
      : { customer: { id: user.userId } };
  }

  private async findOrder(
    manager: EntityManager,
    where: FindOptionsWhere<Order>,
  ) {
    const order = await manager.findOne(Order, {
      where,
      relations: { items: { product: true }, customer: true },
    });
    if (!order) throw new NotFoundException("Order does not exist");
    return order;
  }

  private async restock(manager: EntityManager, order: Order) {
    const items = order.items.filter((i) => i.product);
    if (!items.length) return;

    const products = await manager.find(Product, {
      where: { id: In(items.map((i) => i.product?.id)) },
      lock: { mode: "pessimistic_write" },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const item of items) {
      const product = byId.get(item.product?.id as string);
      if (product) product.stock += item.quantity;
    }
    await manager.save(products);
  }

  private async changeStatus(
    manager: EntityManager,
    order: Order,
    status: OrderStatus,
  ) {
    if (!NEXT_STATUSES[order.status].includes(status))
      throw new BadRequestException(
        `Cannot change order from ${order.status} to ${status}`,
      );

    if (status === OrderStatus.CANCELLED) await this.restock(manager, order);
    order.status = status;
    return manager.save(order);
  }

  async listOrders(user: JwtPayload, query: OrderQueryDto) {
    const [orders, total] = await this.orderRepo.findAndCount({
      where: {
        ...this.scope(user),
        ...(query.status && { status: query.status }),
      },
      relations: { items: true, customer: true },
      order: { createdAt: "DESC" },
      ...pageOptions(query),
    });

    return paginate(toDto(OrderResponseDto, orders), total, query);
  }

  async getOrder(user: JwtPayload, orderId: string) {
    const order = await this.findOrder(this.dataSource.manager, {
      id: orderId,
      ...this.scope(user),
    });
    return toDto(OrderResponseDto, order);
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.dataSource.transaction(async (manager) =>
      this.changeStatus(
        manager,
        await this.findOrder(manager, { id: orderId }),
        dto.status,
      ),
    );
    return toDto(OrderResponseDto, order);
  }

  async cancelOrder(user: JwtPayload, orderId: string) {
    const order = await this.dataSource.transaction(async (manager) => {
      const order = await this.findOrder(manager, {
        id: orderId,
        ...this.scope(user),
      });
      if (order.status !== OrderStatus.PENDING)
        throw new BadRequestException("Only pending orders can be cancelled");

      return this.changeStatus(manager, order, OrderStatus.CANCELLED);
    });
    return toDto(OrderResponseDto, order);
  }
}
