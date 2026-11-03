import { Expose } from "class-transformer";

export class CartItemResponseDto {
  @Expose() productId: string;
  @Expose() name: string;
  @Expose() slug: string;
  @Expose() unitPrice: number;
  @Expose() quantity: number;
  @Expose() lineTotal: number;
}
