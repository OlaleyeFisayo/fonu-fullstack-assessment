import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

export enum TokenType {
  ACCESS = "access",
  REFRESH = "refresh",
}

@Entity()
export class Token {
  @PrimaryColumn("uuid")
  id: string;

  @Index()
  @Column("uuid")
  sessionId: string;

  @Index()
  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: false })
  user: User;

  @Column({ type: "enum", enum: TokenType })
  type: TokenType;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
