import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Product } from "../product/entities/product.entity";
import { UserRole } from "../user/entities/user.entity";
import { Order, OrderStatus } from "./entities/order.entity";
import { OrderService } from "./order.service";

const customer = { userId: "u1", role: UserRole.CUSTOMER };
const admin = { userId: "a1", role: UserRole.ADMIN };

const order = (overrides: Partial<Order> = {}) =>
  ({
    id: "o1",
    status: OrderStatus.PENDING,
    total: 20,
    items: [
      { id: "i1", product: { id: "p1" }, quantity: 2 },
      { id: "i2", product: { id: "p2" }, quantity: 1 },
    ],
    ...overrides,
  }) as Order;

describe("OrderService", () => {
  let service: OrderService;
  const orderRepo = { findAndCount: jest.fn() };
  const manager = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (data) => data),
  };
  const dataSource = { manager, transaction: jest.fn((cb) => cb(manager)) };
  const config: Record<string, string> = {
    REPORTING_URL: "http://reporting:3001",
    REPORTING_TOKEN: "secret",
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();
    service = module.get(OrderService);
  });

  describe("listOrders", () => {
    beforeEach(() => orderRepo.findAndCount.mockResolvedValue([[order()], 1]));

    it("scopes a customer to their own orders", async () => {
      await service.listOrders(customer, { page: 1, limit: 10 });
      expect(orderRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customer: { id: "u1" } } }),
      );
    });

    it("does not scope an admin", async () => {
      await service.listOrders(admin, { page: 1, limit: 10 });
      expect(orderRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it("filters by status only when given", async () => {
      await service.listOrders(admin, {
        page: 2,
        limit: 5,
        status: OrderStatus.PAID,
      });
      expect(orderRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: OrderStatus.PAID },
          skip: 5,
          take: 5,
        }),
      );
    });

    it("returns pagination meta", async () => {
      const result = await service.listOrders(customer, { page: 1, limit: 10 });
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });
  });

  describe("getOrder", () => {
    it("hides another customer's order", async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.getOrder(customer, "o1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(manager.findOne).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          where: { id: "o1", customer: { id: "u1" } },
        }),
      );
    });

    it("lets an admin see any order", async () => {
      manager.findOne.mockResolvedValue(order());
      const result = await service.getOrder(admin, "o1");
      expect(manager.findOne).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({ where: { id: "o1" } }),
      );
      expect(result.id).toBe("o1");
    });
  });

  describe("updateStatus", () => {
    it.each([
      [OrderStatus.PENDING, OrderStatus.PAID],
      [OrderStatus.PENDING, OrderStatus.CANCELLED],
      [OrderStatus.PAID, OrderStatus.SHIPPED],
      [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
    ])("allows %s -> %s", async (from, to) => {
      manager.findOne.mockResolvedValue(order({ status: from }));
      manager.find.mockResolvedValue([]);
      const result = await service.updateStatus("o1", { status: to });
      expect(result.status).toBe(to);
    });

    it.each([
      [OrderStatus.PENDING, OrderStatus.PENDING],
      [OrderStatus.PENDING, OrderStatus.SHIPPED],
      [OrderStatus.PENDING, OrderStatus.DELIVERED],
      [OrderStatus.PAID, OrderStatus.PENDING],
      [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED, OrderStatus.PAID],
      [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED, OrderStatus.PENDING],
      [OrderStatus.CANCELLED, OrderStatus.PENDING],
      [OrderStatus.CANCELLED, OrderStatus.PAID],
    ])("rejects %s -> %s", async (from, to) => {
      manager.findOne.mockResolvedValue(order({ status: from }));
      await expect(service.updateStatus("o1", { status: to })).rejects.toThrow(
        new BadRequestException(`Cannot change order from ${from} to ${to}`),
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it("throws NotFound for a missing order", async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus("o1", { status: OrderStatus.PAID }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("does not touch stock for a non-cancel change", async () => {
      manager.findOne.mockResolvedValue(order());
      await service.updateStatus("o1", { status: OrderStatus.PAID });
      expect(manager.find).not.toHaveBeenCalled();
    });

    it("restocks when an admin cancels a paid order", async () => {
      manager.findOne.mockResolvedValue(order({ status: OrderStatus.PAID }));
      const products = [
        { id: "p1", stock: 0 },
        { id: "p2", stock: 4 },
      ];
      manager.find.mockResolvedValue(products);

      await service.updateStatus("o1", { status: OrderStatus.CANCELLED });

      expect(manager.find).toHaveBeenCalledWith(
        Product,
        expect.objectContaining({ lock: { mode: "pessimistic_write" } }),
      );
      expect(products.map((p) => p.stock)).toEqual([2, 5]);
      expect(manager.save).toHaveBeenCalledWith(products);
    });
  });

  describe("restock edge cases", () => {
    it("skips items whose product was deleted", async () => {
      manager.findOne.mockResolvedValue(
        order({
          items: [
            { id: "i1", product: null, quantity: 2 },
            { id: "i2", product: { id: "p2" }, quantity: 1 },
          ] as Order["items"],
        }),
      );
      const products = [{ id: "p2", stock: 0 }];
      manager.find.mockResolvedValue(products);

      await service.cancelOrder(customer, "o1");

      expect(products[0].stock).toBe(1);
    });

    it("skips restocking when every product was deleted", async () => {
      manager.findOne.mockResolvedValue(
        order({
          items: [{ id: "i1", product: null, quantity: 2 }] as Order["items"],
        }),
      );
      const result = await service.cancelOrder(customer, "o1");
      expect(manager.find).not.toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe("cancelOrder", () => {
    it("only cancels pending orders", async () => {
      manager.findOne.mockResolvedValue(order({ status: OrderStatus.PAID }));
      await expect(service.cancelOrder(customer, "o1")).rejects.toThrow(
        new BadRequestException("Only pending orders can be cancelled"),
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it("hides another customer's order", async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.cancelOrder(customer, "o1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(manager.findOne).toHaveBeenCalledWith(
        Order,
        expect.objectContaining({
          where: { id: "o1", customer: { id: "u1" } },
        }),
      );
    });

    it("cancels and restocks a pending order", async () => {
      manager.findOne.mockResolvedValue(order());
      const products = [
        { id: "p1", stock: 1 },
        { id: "p2", stock: 1 },
      ];
      manager.find.mockResolvedValue(products);

      const result = await service.cancelOrder(customer, "o1");

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(products.map((p) => p.stock)).toEqual([3, 2]);
    });
  });

  describe("getSummary", () => {
    const query = { from: "2026-01-01", to: "2026-01-31" };
    const reply = (status: number, body: unknown) =>
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response(JSON.stringify(body), { status }));

    afterEach(() => jest.restoreAllMocks());

    it("calls the reporting service with the token and dates", async () => {
      const summary = { totalOrders: 3, revenue: "60.00" };
      const fetchSpy = reply(200, summary);

      await expect(service.getSummary(query)).resolves.toEqual(summary);

      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toBe(
        "http://reporting:3001/orders/summary?from=2026-01-01&to=2026-01-31",
      );
      expect(init?.headers).toEqual({ "X-Internal-Token": "secret" });
    });

    it("passes a 400 from the reporting service through", async () => {
      reply(400, { error: "from must be on or before to" });
      await expect(service.getSummary(query)).rejects.toThrow(
        new BadRequestException("from must be on or before to"),
      );
    });

    it("throws 503 when the reporting service errors", async () => {
      reply(500, { error: "failed to build summary" });
      await expect(service.getSummary(query)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it("throws 503 when the reporting service is unreachable", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("failed"));
      await expect(service.getSummary(query)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
