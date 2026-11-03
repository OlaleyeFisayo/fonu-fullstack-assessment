import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { moneyColumn } from "../../../shared/utils/money";
import { Product } from "../../product/entities/product.entity";
import { Order } from "./order.entity";

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(
    () => Order,
    (order) => order.items,
    { nullable: false, onDelete: "CASCADE" },
  )
  order: Order;

  @ManyToOne(() => Product, { nullable: true, onDelete: "SET NULL" })
  product: Product | null;

  @Column()
  productName: string;

  @Column(moneyColumn)
  unitPrice: number;

  @Column({
    type: "int",
  })
  quantity: number;
}
