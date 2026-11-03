import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from "typeorm";
import { Product } from "../../product/entities/product.entity";
import { Cart } from "./cart.entity";

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
  cart: Relation<Cart>;

  @ManyToOne(() => Product, { nullable: false, onDelete: "CASCADE" })
  product: Product;

  @Column({
    type: "int",
  })
  quantity: number;
}
