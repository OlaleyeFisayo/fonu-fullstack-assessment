import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiEnvelope } from "../../shared/decorators/response.decorator";

import { JwtPayload } from "../../shared/types";
import { JwtAuthGuard } from "../auth/guards/jwtAuthGuard";
import { Roles } from "../user/decorators/roles.decorator";
import { UserRole } from "../user/entities/user.entity";
import { RolesGuard } from "../user/guards/rolesGuard";
import { ProductDto, UpdateProductDto } from "./dtos/product.dto";
import { ProductQueryDto } from "./dtos/productQuery.dto";
import { ProductResponseDto } from "./dtos/productResponse.dto";
import { ProductService } from "./product.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("Product")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("product")
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiEnvelope({
    status: 200,
    message: "Products retrieved",
    type: ProductResponseDto,
    paginated: true,
  })
  async listProducts(@Query() query: ProductQueryDto) {
    return await this.productService.getProducts(query);
  }

  @Post()
  @Roles([UserRole.ADMIN])
  @ApiEnvelope({
    status: 201,
    message: "Product created",
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid product data" })
  @ApiForbiddenResponse({ description: "Admins only" })
  async createProduct(
    @Req() req: { user: JwtPayload },
    @Body() productDto: ProductDto,
  ) {
    return await this.productService.createProduct(req.user.userId, productDto);
  }

  @Get(":slug")
  @ApiEnvelope({
    status: 200,
    message: "Product retrieved",
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({ description: "Product does not exist" })
  async getProduct(@Param("slug") slug: string) {
    return await this.productService.getProduct(slug);
  }

  @Patch(":productId")
  @Roles([UserRole.ADMIN])
  @ApiEnvelope({
    status: 200,
    message: "Product updated",
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid product data" })
  @ApiForbiddenResponse({ description: "Admins only" })
  @ApiNotFoundResponse({ description: "Product does not exist" })
  async updateProduct(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return await this.productService.updateProduct(productId, updateProductDto);
  }

  @Delete(":productId")
  @Roles([UserRole.ADMIN])
  @ApiEnvelope({
    status: 200,
    message: "Product deleted",
    type: ProductResponseDto,
  })
  @ApiForbiddenResponse({ description: "Admins only" })
  @ApiBadRequestResponse({ description: "Invalid product id" })
  @ApiNotFoundResponse({ description: "Product does not exist" })
  async deleteProduct(@Param("productId", ParseUUIDPipe) productId: string) {
    return await this.productService.deleteProduct(productId);
  }
}
