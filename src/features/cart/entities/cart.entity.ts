import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { CartItem } from "./cartItem.entity";

@Entity()
export class Cart {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @OneToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn()
  customer: User;

  @OneToMany(
    () => CartItem,
    (item) => item.cart,
    { cascade: true },
  )
  items: Relation<CartItem[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
