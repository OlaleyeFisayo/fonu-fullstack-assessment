import { Expose, Type } from "class-transformer";
import { CartItemResponseDto } from "./cartItemResponse.dto";

export class CartResponseDto {
  @Expose() id: string;
  @Expose() subtotal: number;

  @Expose()
  @Type(() => CartItemResponseDto)
  items: CartItemResponseDto[];
}
