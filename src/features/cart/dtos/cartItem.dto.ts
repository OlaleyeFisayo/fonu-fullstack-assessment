import { PickType } from "@nestjs/swagger";
import { IsInt, IsUUID, Min } from "class-validator";

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class UpdateCartItemDto extends PickType(AddCartItemDto, ["quantity"]) {}
