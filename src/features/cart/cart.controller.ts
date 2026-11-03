import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { OrderResponseDto } from "../order/dtos/orderResponse.dto";
import { Roles } from "../user/decorators/roles.decorator";
import { UserRole } from "../user/entities/user.entity";
import { RolesGuard } from "../user/guards/rolesGuard";
import { CartService } from "./cart.service";
import { AddCartItemDto, UpdateCartItemDto } from "./dtos/cartItem.dto";
import { CartResponseDto } from "./dtos/cartResponse.dto";

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([UserRole.CUSTOMER])
@ApiTags("Cart")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@ApiForbiddenResponse({ description: "Customers only" })
@Controller("cart")
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiEnvelope({
    status: 200,
    message: "Cart retrieved",
    type: CartResponseDto,
  })
  async getCart(@Req() req: { user: JwtPayload }) {
    return await this.cartService.getCart(req.user.userId);
  }

  @Post("items")
  @ApiEnvelope({
    status: 201,
    message: "Item added to cart",
    type: CartResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid data or not enough stock" })
  @ApiNotFoundResponse({ description: "Product does not exist" })
  async addItem(
    @Req() req: { user: JwtPayload },
    @Body() addCartItemDto: AddCartItemDto,
  ) {
    return await this.cartService.addItem(req.user.userId, addCartItemDto);
  }

  @Patch("items/:productId")
  @ApiEnvelope({
    status: 200,
    message: "Cart item updated",
    type: CartResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid data or not enough stock" })
  @ApiNotFoundResponse({ description: "Product is not in cart" })
  async updateItem(
    @Req() req: { user: JwtPayload },
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return await this.cartService.updateItem(
      req.user.userId,
      productId,
      updateCartItemDto,
    );
  }

  @Delete("items/:productId")
  @ApiEnvelope({
    status: 200,
    message: "Item removed from cart",
    type: CartResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid product id" })
  @ApiNotFoundResponse({ description: "Product is not in cart" })
  async removeItem(
    @Req() req: { user: JwtPayload },
    @Param("productId", ParseUUIDPipe) productId: string,
  ) {
    return await this.cartService.removeItem(req.user.userId, productId);
  }

  @Post("checkout")
  @ApiEnvelope({
    status: 201,
    message: "Order placed",
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({ description: "Cart is empty or not enough stock" })
  async checkout(@Req() req: { user: JwtPayload }) {
    return await this.cartService.checkout(req.user.userId);
  }
}
