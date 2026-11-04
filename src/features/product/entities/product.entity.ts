import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { moneyColumn } from "../../../shared/utils/money";
import { User } from "../../user/entities/user.entity";

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

@Entity()
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({
    type: "text",
    nullable: true,
  })
  description: string | null;

  @Column(moneyColumn)
  price: number;

  @Column({
    type: "int",
  })
  stock: number;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  createdBy: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  setSlug() {
    this.slug = slugify(this.name);
  }
}
