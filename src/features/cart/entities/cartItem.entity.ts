import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { Product } from "../../product/entities/product.entity";
import { Cart } from "./cart.entity";

// one row per product per cart; adding again bumps the quantity
@Entity()
@Unique(["cart", "product"])
export class CartItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(
    () => Cart,
    (cart) => cart.items,
    { nullable: false, onDelete: "CASCADE" },
  )
  cart: Cart;

  // no price snapshot: a cart always shows the live product price
  @ManyToOne(() => Product, { nullable: false, onDelete: "CASCADE" })
  product: Product;

  @Column({
    type: "int",
  })
  quantity: number;
}
