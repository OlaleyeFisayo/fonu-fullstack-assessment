import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ILike, QueryFailedError } from "typeorm";
import { Product, slugify } from "./entities/product.entity";
import { ProductService } from "./product.service";

const product = (overrides: Partial<Product> = {}) =>
  ({
    id: "p1",
    name: "Wireless Mouse",
    slug: "wireless-mouse",
    description: null,
    price: 25.99,
    stock: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: "admin", password: "hash" },
    ...overrides,
  }) as Product;

const uniqueViolation = () =>
  new QueryFailedError(
    "INSERT",
    [],
    Object.assign(new Error("dup"), { code: "23505" }),
  );

describe("ProductService", () => {
  let service: ProductService;
  const repo = {
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (p) => ({ id: "p1", ...p })),
    merge: jest.fn((target, data) => Object.assign(target, data)),
    remove: jest.fn(async (p) => ({ ...p, id: undefined })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(Product), useValue: repo },
      ],
    }).compile();
    service = module.get(ProductService);
  });

  describe("createProduct", () => {
    it("links the creator and does not leak createdBy", async () => {
      const result = await service.createProduct("admin", {
        name: "Mouse",
        description: "x",
        price: 10,
        stock: 1,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: { id: "admin" } }),
      );
      expect(result).not.toHaveProperty("createdBy");
      expect(result.name).toBe("Mouse");
    });

    it("throws Conflict on a duplicate slug", async () => {
      repo.save.mockRejectedValueOnce(uniqueViolation());
      await expect(
        service.createProduct("admin", {
          name: "Mouse",
          description: "",
          price: 1,
          stock: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rethrows other database errors", async () => {
      const error = new Error("connection lost");
      repo.save.mockRejectedValueOnce(error);
      await expect(
        service.createProduct("admin", {
          name: "Mouse",
          description: "",
          price: 1,
          stock: 1,
        }),
      ).rejects.toBe(error);
    });
  });

  describe("getProducts", () => {
    it("has no filter without search", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.getProducts({ page: 1, limit: 10 });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 10 }),
      );
    });

    it("searches by name case-insensitively", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.getProducts({ page: 1, limit: 10, search: "mou" });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: ILike("%mou%") } }),
      );
    });

    it("converts page and limit into skip and take", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.getProducts({ page: 3, limit: 10 });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it("rounds totalPages up", async () => {
      repo.findAndCount.mockResolvedValue([[product()], 21]);
      const result = await service.getProducts({ page: 1, limit: 10 });
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 21,
        totalPages: 3,
      });
      expect(result.items).toHaveLength(1);
    });

    it("returns zero pages when empty", async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.getProducts({ page: 1, limit: 10 });
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe("getProduct", () => {
    it("finds by slug", async () => {
      repo.findOneBy.mockResolvedValue(product());
      const result = await service.getProduct("wireless-mouse");
      expect(repo.findOneBy).toHaveBeenCalledWith({ slug: "wireless-mouse" });
      expect(result.id).toBe("p1");
    });

    it("throws NotFound when missing", async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.getProduct("nope")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("updateProduct", () => {
    it("throws NotFound when missing", async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(
        service.updateProduct("p1", { price: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("keeps untouched fields on a partial update", async () => {
      repo.findOneBy.mockResolvedValue(product());
      const result = await service.updateProduct("p1", { price: 5 });
      expect(result.price).toBe(5);
      expect(result.name).toBe("Wireless Mouse");
      expect(result.stock).toBe(10);
    });

    it("throws Conflict when renamed to an existing name", async () => {
      repo.findOneBy.mockResolvedValue(product());
      repo.save.mockRejectedValueOnce(uniqueViolation());
      await expect(
        service.updateProduct("p1", { name: "USB-C Hub" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("deleteProduct", () => {
    it("throws NotFound when missing", async () => {
      repo.findOneBy.mockResolvedValue(null);
      await expect(service.deleteProduct("p1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it("keeps the id even though remove clears it", async () => {
      repo.findOneBy.mockResolvedValue(product());
      const result = await service.deleteProduct("p1");
      expect(result.id).toBe("p1");
    });
  });
});

describe("Product slug", () => {
  it.each([
    ['27" Monitor', "27-monitor"],
    ["  USB-C   Hub!! ", "usb-c-hub"],
    ["--Laptop Stand--", "laptop-stand"],
    ["Café Mug", "caf-mug"],
  ])("slugify(%j) = %j", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("setSlug follows a rename", () => {
    const entity = Object.assign(new Product(), { name: "Old Name" });
    entity.setSlug();
    entity.name = "New Name";
    entity.setSlug();
    expect(entity.slug).toBe("new-name");
  });
});
