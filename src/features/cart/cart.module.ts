import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "../product/entities/product.entity";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { Cart } from "./entities/cart.entity";
import { CartItem } from "./entities/cartItem.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Product])],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
