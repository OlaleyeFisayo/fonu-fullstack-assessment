import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Order } from "../order/entities/order.entity";
import { OrderItem } from "../order/entities/orderItem.entity";
import { Product } from "../product/entities/product.entity";
import { CartService } from "./cart.service";
import { Cart } from "./entities/cart.entity";
import { CartItem } from "./entities/cartItem.entity";

const product = (overrides: Partial<Product> = {}) =>
  ({
    id: "p1",
    name: "Mouse",
    slug: "mouse",
    price: 10,
    stock: 5,
    ...overrides,
  }) as Product;

const cartWith = (...items: { product: Product; quantity: number }[]) =>
  ({
    id: "c1",
    items: items.map((i, n) => ({ id: `ci${n}`, ...i })),
  }) as Cart;

describe("CartService", () => {
  let service: CartService;
  const cartRepo = {
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (c) => ({ id: "new-cart", ...c })),
  };
  const cartItemRepo = {
    create: jest.fn((data) => data),
    save: jest.fn(async (i) => i),
    remove: jest.fn(),
  };
  const productRepo = { findOneBy: jest.fn() };
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((_entity, data) => data),
    save: jest.fn(async (data) =>
      Array.isArray(data) ? data : { id: "o1", status: "pending", ...data },
    ),
    delete: jest.fn(),
  };
  const dataSource = { transaction: jest.fn((cb) => cb(manager)) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Cart), useValue: cartRepo },
        { provide: getRepositoryToken(CartItem), useValue: cartItemRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(CartService);
  });

  describe("getCart", () => {
    it("maps items and computes the subtotal", async () => {
      cartRepo.findOne.mockResolvedValue(
        cartWith(
          { product: product(), quantity: 2 },
          { product: product({ id: "p2", price: 2.5 }), quantity: 3 },
        ),
      );
      const result = await service.getCart("u1");
      expect(result.subtotal).toBe(27.5);
      expect(result.items[0]).toEqual({
        productId: "p1",
        name: "Mouse",
        slug: "mouse",
        unitPrice: 10,
        quantity: 2,
        lineTotal: 20,
      });
    });

    it("creates an empty cart the first time", async () => {
      cartRepo.findOne.mockResolvedValue(null);
      const result = await service.getCart("u1");
      expect(cartRepo.save).toHaveBeenCalledWith({ customer: { id: "u1" } });
      expect(result).toEqual({ id: "new-cart", subtotal: 0, items: [] });
    });

    it("rounds float money", async () => {
      cartRepo.findOne.mockResolvedValue(
        cartWith({ product: product({ price: 0.1 }), quantity: 3 }),
      );
      const result = await service.getCart("u1");
      expect(result.items[0].lineTotal).toBe(0.3);
      expect(result.subtotal).toBe(0.3);
    });
  });

  describe("addItem", () => {
    it("throws NotFound for an unknown product", async () => {
      productRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.addItem("u1", { productId: "p1", quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("adds a new line", async () => {
      productRepo.findOneBy.mockResolvedValue(product());
      cartRepo.findOne.mockResolvedValue(cartWith());
      const result = await service.addItem("u1", {
        productId: "p1",
        quantity: 2,
      });
      expect(cartItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cart: { id: "c1" }, quantity: 2 }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.subtotal).toBe(20);
    });

    it("sums the quantity of an existing line instead of duplicating it", async () => {
      productRepo.findOneBy.mockResolvedValue(product());
      cartRepo.findOne.mockResolvedValue(
        cartWith({ product: product(), quantity: 2 }),
      );
      const result = await service.addItem("u1", {
        productId: "p1",
        quantity: 3,
      });
      expect(cartItemRepo.create).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(5);
    });

    it("allows exactly the stock", async () => {
      productRepo.findOneBy.mockResolvedValue(product({ stock: 5 }));
      cartRepo.findOne.mockResolvedValue(cartWith());
      await expect(
        service.addItem("u1", { productId: "p1", quantity: 5 }),
      ).resolves.toBeDefined();
    });

    it("rejects more than the stock", async () => {
      productRepo.findOneBy.mockResolvedValue(product({ stock: 5 }));
      cartRepo.findOne.mockResolvedValue(cartWith());
      await expect(
        service.addItem("u1", { productId: "p1", quantity: 6 }),
      ).rejects.toThrow(new BadRequestException("Only 5 left of Mouse"));
      expect(cartItemRepo.save).not.toHaveBeenCalled();
    });

    it("rejects when the summed quantity exceeds the stock", async () => {
      productRepo.findOneBy.mockResolvedValue(product({ stock: 5 }));
      cartRepo.findOne.mockResolvedValue(
        cartWith({ product: product(), quantity: 4 }),
      );
      await expect(
        service.addItem("u1", { productId: "p1", quantity: 2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("updateItem", () => {
    it("throws NotFound when the product is not in the cart", async () => {
      cartRepo.findOne.mockResolvedValue(cartWith());
      await expect(
        service.updateItem("u1", "p1", { quantity: 1 }),
      ).rejects.toThrow(new NotFoundException("Product is not in cart"));
    });

    it("rejects more than the stock", async () => {
      cartRepo.findOne.mockResolvedValue(
        cartWith({ product: product({ stock: 5 }), quantity: 1 }),
      );
      await expect(
        service.updateItem("u1", "p1", { quantity: 6 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("replaces the quantity rather than adding to it", async () => {
      cartRepo.findOne.mockResolvedValue(
        cartWith({ product: product(), quantity: 4 }),
      );
      const result = await service.updateItem("u1", "p1", { quantity: 1 });
      expect(result.items[0].quantity).toBe(1);
    });
  });

  describe("removeItem", () => {
    it("throws NotFound when the product is not in the cart", async () => {
      cartRepo.findOne.mockResolvedValue(cartWith());
      await expect(service.removeItem("u1", "p1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("removes the line", async () => {
      cartRepo.findOne.mockResolvedValue(
        cartWith(
          { product: product(), quantity: 1 },
          { product: product({ id: "p2" }), quantity: 1 },
        ),
      );
      const result = await service.removeItem("u1", "p1");
      expect(cartItemRepo.remove).toHaveBeenCalled();
      expect(result.items.map((i) => i.productId)).toEqual(["p2"]);
    });
  });

  describe("checkout", () => {
    it("rejects when there is no cart", async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.checkout("u1")).rejects.toThrow(
        new BadRequestException("Cart is empty"),
      );
    });

    it("rejects an empty cart", async () => {
      manager.findOne.mockResolvedValue(cartWith());
      await expect(service.checkout("u1")).rejects.toThrow(
        new BadRequestException("Cart is empty"),
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it("rejects when stock dropped since the item was added", async () => {
      manager.findOne.mockResolvedValue(
        cartWith({ product: product(), quantity: 3 }),
      );
      manager.find.mockResolvedValue([product({ stock: 2 })]);
      await expect(service.checkout("u1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(manager.save).not.toHaveBeenCalled();
      expect(manager.delete).not.toHaveBeenCalled();
    });

    it("places the order, takes stock and empties the cart", async () => {
      manager.findOne.mockResolvedValue(
        cartWith(
          { product: product(), quantity: 2 },
          { product: product({ id: "p2", name: "Pad" }), quantity: 3 },
        ),
      );
      const locked = [
        product({ price: 0.1, stock: 5 }),
        product({ id: "p2", name: "Pad", price: 0.2, stock: 3 }),
      ];
      manager.find.mockResolvedValue(locked);

      const order = await service.checkout("u1");

      expect(manager.find).toHaveBeenCalledWith(
        Product,
        expect.objectContaining({ lock: { mode: "pessimistic_write" } }),
      );
      expect(locked.map((p) => p.stock)).toEqual([3, 0]);
      expect(manager.create).toHaveBeenCalledWith(OrderItem, {
        product: locked[0],
        productName: "Mouse",
        unitPrice: 0.1,
        quantity: 2,
      });
      expect(manager.create).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({ customer: { id: "u1" }, total: 0.8 }),
      );
      expect(manager.save).toHaveBeenCalledWith(locked);
      expect(manager.delete).toHaveBeenCalledWith(CartItem, {
        cart: { id: "c1" },
      });
      expect(order.total).toBe(0.8);
      expect(order.items).toHaveLength(2);
    });
  });
});
