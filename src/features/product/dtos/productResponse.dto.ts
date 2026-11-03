import { OmitType } from "@nestjs/swagger";
import { Expose } from "class-transformer";
import { Product } from "../entities/product.entity";

export class ProductResponseDto extends OmitType(Product, [
  "createdBy",
  "setSlug",
]) {
  @Expose() id: string;
  @Expose() name: string;
  @Expose() slug: string;
  @Expose() description: string | null;
  @Expose() price: number;
  @Expose() stock: number;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
}
