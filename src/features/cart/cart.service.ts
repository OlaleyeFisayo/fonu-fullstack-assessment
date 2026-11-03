import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { roundMoney } from "../../shared/utils/money";
import { toDto } from "../../shared/utils/toDto";
import { OrderResponseDto } from "../order/dtos/orderResponse.dto";
import { Order } from "../order/entities/order.entity";
import { OrderItem } from "../order/entities/orderItem.entity";
import { Product } from "../product/entities/product.entity";
import { AddCartItemDto, UpdateCartItemDto } from "./dtos/cartItem.dto";
import { CartResponseDto } from "./dtos/cartResponse.dto";
import { Cart } from "./entities/cart.entity";
import { CartItem } from "./entities/cartItem.entity";

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  private async getOrCreateCart(userId: string) {
    const cart = await this.cartRepo.findOne({
      where: { customer: { id: userId } },
      relations: { items: { product: true } },
    });
    if (cart) return cart;

    const created = await this.cartRepo.save(
      this.cartRepo.create({ customer: { id: userId } }),
    );
    created.items = [];
    return created;
  }

  private findCartItem(cart: Cart, productId: string) {
    const item = cart.items.find((i) => i.product.id === productId);
    if (!item) throw new NotFoundException("Product is not in cart");
    return item;
  }

  private assertStock(product: Product, quantity: number) {
    if (quantity > product.stock)
      throw new BadRequestException(
        `Only ${product.stock} left of ${product.name}`,
      );
  }

  private toResponse(cart: Cart) {
    const items = cart.items.map((i) => ({
      productId: i.product.id,
      name: i.product.name,
      slug: i.product.slug,
      unitPrice: i.product.price,
      quantity: i.quantity,
      lineTotal: roundMoney(i.product.price * i.quantity),
    }));
    const subtotal = roundMoney(items.reduce((sum, i) => sum + i.lineTotal, 0));
    return toDto(CartResponseDto, { id: cart.id, subtotal, items });
  }

  async getCart(userId: string) {
    return this.toResponse(await this.getOrCreateCart(userId));
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.productRepo.findOneBy({ id: dto.productId });
    if (!product) throw new NotFoundException("Product does not exist");

    const cart = await this.getOrCreateCart(userId);
    const existing = cart.items.find((i) => i.product.id === product.id);
    const quantity = (existing?.quantity ?? 0) + dto.quantity;
    this.assertStock(product, quantity);

    if (existing) {
      existing.quantity = quantity;
      await this.cartItemRepo.save(existing);
    } else {
      cart.items.push(
        await this.cartItemRepo.save(
          this.cartItemRepo.create({
            cart: { id: cart.id },
            product,
            quantity,
          }),
        ),
      );
    }
    return this.toResponse(cart);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);
    const item = this.findCartItem(cart, productId);
    this.assertStock(item.product, dto.quantity);

    item.quantity = dto.quantity;
    await this.cartItemRepo.save(item);
    return this.toResponse(cart);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.getOrCreateCart(userId);
    const item = this.findCartItem(cart, productId);

    await this.cartItemRepo.remove(item);
    cart.items = cart.items.filter((i) => i !== item);
    return this.toResponse(cart);
  }

  async checkout(userId: string) {
    const order = await this.dataSource.transaction(async (manager) => {
      const cart = await manager.findOne(Cart, {
        where: { customer: { id: userId } },
        relations: { items: { product: true } },
      });
      if (!cart?.items.length) throw new BadRequestException("Cart is empty");

      const products = await manager.find(Product, {
        where: { id: In(cart.items.map((i) => i.product.id)) },
        lock: { mode: "pessimistic_write" },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      const items = cart.items.map((cartItem) => {
        const product = byId.get(cartItem.product.id) as Product;
        this.assertStock(product, cartItem.quantity);
        product.stock -= cartItem.quantity;

        return manager.create(OrderItem, {
          product,
          productName: product.name,
          unitPrice: product.price,
          quantity: cartItem.quantity,
        });
      });
      const total = roundMoney(
        items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      );

      const saved = await manager.save(
        manager.create(Order, { customer: { id: userId }, items, total }),
      );
      await manager.save(products);
      await manager.delete(CartItem, { cart: { id: cart.id } });
      return saved;
    });

    return toDto(OrderResponseDto, order);
  }
}
