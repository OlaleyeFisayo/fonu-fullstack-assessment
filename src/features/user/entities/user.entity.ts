import { hash } from "argon2";
import {
  BeforeInsert,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

export enum UserRole {
  ADMIN = "admin",
  CUSTOMER = "customer",
}

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Unique(["email"])
  @Column()
  email: string;

  @Column()
  password: string;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({
    type: "varchar",
    nullable: true,
  })
  hashedRefreshToken: string | null;

  @BeforeInsert()
  async hashPassword() {
    this.password = await hash(this.password);
  }
}
