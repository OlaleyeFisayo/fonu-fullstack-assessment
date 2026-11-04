import { ClassConstructor, plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { LoginDto } from "./auth/dtos/login.dto";
import { RefreshTokenDto } from "./auth/dtos/refreshToken.dto";
import { SignUpDto } from "./auth/dtos/signUp.dto";
import { AddCartItemDto, UpdateCartItemDto } from "./cart/dtos/cartItem.dto";
import { OrderQueryDto } from "./order/dtos/orderQuery.dto";
import { UpdateOrderStatusDto } from "./order/dtos/updateOrderStatus.dto";
import { ProductDto, UpdateProductDto } from "./product/dtos/product.dto";
import { ProductQueryDto } from "./product/dtos/productQuery.dto";

async function check<T extends object>(dto: ClassConstructor<T>, body: object) {
  const instance = plainToInstance(dto, body, {
    enableImplicitConversion: true,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, valid: errors.length === 0 };
}

const UUID = "3f2b1c9e-8a4d-4e6f-9b2a-1c3d5e7f9a0b";
const PRODUCT = { name: "Mouse", price: 10, stock: 1 };

describe("AddCartItemDto", () => {
  it("accepts a valid body", async () => {
    expect(
      (await check(AddCartItemDto, { productId: UUID, quantity: 1 })).valid,
    ).toBe(true);
  });

  it.each([0, -1, 1.5])("rejects quantity %p", async (quantity) => {
    expect(
      (await check(AddCartItemDto, { productId: UUID, quantity })).valid,
    ).toBe(false);
  });

  it("rejects a non-uuid productId", async () => {
    expect(
      (await check(AddCartItemDto, { productId: "abc", quantity: 1 })).valid,
    ).toBe(false);
  });

  it("rejects unknown fields", async () => {
    expect(
      (await check(AddCartItemDto, { productId: UUID, quantity: 1, price: 0 }))
        .valid,
    ).toBe(false);
  });
});

describe("UpdateCartItemDto", () => {
  it("accepts quantity only", async () => {
    expect((await check(UpdateCartItemDto, { quantity: 2 })).valid).toBe(true);
  });

  it("rejects productId", async () => {
    expect(
      (await check(UpdateCartItemDto, { quantity: 2, productId: UUID })).valid,
    ).toBe(false);
  });

  it("rejects quantity 0", async () => {
    expect((await check(UpdateCartItemDto, { quantity: 0 })).valid).toBe(false);
  });
});

describe("ProductDto", () => {
  it("accepts a valid body without description", async () => {
    expect((await check(ProductDto, PRODUCT)).valid).toBe(true);
  });

  it("accepts zero stock", async () => {
    expect((await check(ProductDto, { ...PRODUCT, stock: 0 })).valid).toBe(
      true,
    );
  });

  it.each([
    ["empty name", { name: "" }],
    ["zero price", { price: 0 }],
    ["negative price", { price: -1 }],
    ["three decimal price", { price: 1.999 }],
    ["negative stock", { stock: -5 }],
    ["fractional stock", { stock: 1.5 }],
    ["missing stock", { stock: undefined }],
  ])("rejects %s", async (_label, override) => {
    expect((await check(ProductDto, { ...PRODUCT, ...override })).valid).toBe(
      false,
    );
  });
});

describe("UpdateProductDto", () => {
  it("accepts an empty body", async () => {
    expect((await check(UpdateProductDto, {})).valid).toBe(true);
  });

  it("still validates fields that are sent", async () => {
    expect((await check(UpdateProductDto, { stock: -1 })).valid).toBe(false);
  });
});

describe("pagination queries", () => {
  it("defaults to page 1, limit 10", async () => {
    const { instance, valid } = await check(ProductQueryDto, {});
    expect(valid).toBe(true);
    expect(instance).toMatchObject({ page: 1, limit: 10 });
  });

  it("converts query strings to numbers", async () => {
    const { instance, valid } = await check(ProductQueryDto, {
      page: "2",
      limit: "5",
    });
    expect(valid).toBe(true);
    expect(instance).toMatchObject({ page: 2, limit: 5 });
  });

  it.each([
    ["page 0", { page: "0" }],
    ["limit 101", { limit: "101" }],
    ["non-numeric page", { page: "abc" }],
    ["empty search", { search: "" }],
  ])("rejects %s", async (_label, query) => {
    expect((await check(ProductQueryDto, query)).valid).toBe(false);
  });

  it("rejects an unknown order status filter", async () => {
    expect((await check(OrderQueryDto, { status: "lost" })).valid).toBe(false);
  });

  it("accepts a known order status filter", async () => {
    expect((await check(OrderQueryDto, { status: "paid" })).valid).toBe(true);
  });
});

describe("UpdateOrderStatusDto", () => {
  it("rejects an unknown status", async () => {
    expect((await check(UpdateOrderStatusDto, { status: "lost" })).valid).toBe(
      false,
    );
  });
});

describe("auth DTOs", () => {
  it("rejects a bad email on signup", async () => {
    expect(
      (await check(SignUpDto, { name: "A", email: "nope", password: "x" }))
        .valid,
    ).toBe(false);
  });

  it("rejects an empty password on login", async () => {
    expect(
      (await check(LoginDto, { email: "a@b.com", password: "" })).valid,
    ).toBe(false);
  });

  it("rejects role escalation on signup", async () => {
    expect(
      (
        await check(SignUpDto, {
          name: "A",
          email: "a@b.com",
          password: "x",
          role: "admin",
        })
      ).valid,
    ).toBe(false);
  });

  it("rejects an empty refresh token", async () => {
    expect((await check(RefreshTokenDto, { refreshToken: "" })).valid).toBe(
      false,
    );
  });
});
