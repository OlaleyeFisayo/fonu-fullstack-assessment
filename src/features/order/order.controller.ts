import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { User, UserRole } from "../user/entities/user.entity";
import { RolesGuard } from "../user/guards/rolesGuard";
import { OrderQueryDto } from "./dtos/orderQuery.dto";
import { OrderResponseDto } from "./dtos/orderResponse.dto";
import { UpdateOrderStatusDto } from "./dtos/updateOrderStatus.dto";
import { OrderService } from "./order.service";

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("Order")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
@Controller("order")
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @ApiEnvelope({
    status: 200,
    message: "Orders retrieved",
    type: OrderResponseDto,
    paginated: true,
  })
  @ApiBadRequestResponse({ description: "Invalid query" })
  async listOrders(
    @Req() req: { user: JwtPayload },
    @Query() query: OrderQueryDto,
  ) {
    return await this.orderService.listOrders(req.user, query);
  }

  @Get(":orderId")
  @ApiEnvelope({
    status: 200,
    message: "Order retrieved",
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid order id" })
  @ApiNotFoundResponse({ description: "Order does not exist" })
  async getOrder(
    @Req() req: { user: JwtPayload },
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return await this.orderService.getOrder(req.user, orderId);
  }

  @Patch(":orderId/status")
  @Roles([UserRole.ADMIN])
  @ApiEnvelope({
    status: 200,
    message: "Order status updated",
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({ description: "Invalid status change" })
  @ApiForbiddenResponse({ description: "Admins only" })
  @ApiNotFoundResponse({ description: "Order does not exist" })
  async updateStatus(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return await this.orderService.updateStatus(orderId, updateOrderStatusDto);
  }

  @Post(":orderId/cancel")
  @HttpCode(HttpStatus.OK)
  @Roles([UserRole.CUSTOMER])
  @ApiEnvelope({
    status: 200,
    message: "Order cancelled",
    type: OrderResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Only pending orders can be cancelled",
  })
  @ApiForbiddenResponse({ description: "Customers only" })
  @ApiNotFoundResponse({ description: "Order does not exist" })
  async cancelOrder(
    @Req() req: { user: JwtPayload },
    @Param("orderId", ParseUUIDPipe) orderId: string,
  ) {
    return await this.orderService.cancelOrder(req.user, orderId);
  }
}
