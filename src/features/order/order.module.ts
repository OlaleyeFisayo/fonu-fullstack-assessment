import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "../product/entities/product.entity";
import { Order } from "./entities/order.entity";
import { OrderItem } from "./entities/orderItem.entity";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Product])],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
