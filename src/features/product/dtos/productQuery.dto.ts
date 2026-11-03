import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../shared/dtos/paginationQuery.dto";

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;
}
