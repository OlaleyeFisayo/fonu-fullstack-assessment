import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { FindOptionsWhere, ILike, QueryFailedError, Repository } from "typeorm";
import { pageOptions, paginate } from "../../shared/utils/paginate";
import { toDto } from "../../shared/utils/toDto";
import { ProductDto, UpdateProductDto } from "./dtos/product.dto";
import { ProductQueryDto } from "./dtos/productQuery.dto";
import { ProductResponseDto } from "./dtos/productResponse.dto";
import { Product } from "./entities/product.entity";

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  private async findProduct(where: FindOptionsWhere<Product>) {
    const product = await this.productRepo.findOneBy(where);

    if (!product) throw new NotFoundException("Product does not exist");
    return product;
  }

  private async saveProduct(product: Product) {
    try {
      return await this.productRepo.save(product);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === "23505"
      )
        throw new ConflictException("Product with this name already exists");
      throw error;
    }
  }

  async createProduct(userId: string, productDto: ProductDto) {
    const product = await this.saveProduct(
      this.productRepo.create({ ...productDto, createdBy: { id: userId } }),
    );

    return toDto(ProductResponseDto, product);
  }

  async getProducts(query: ProductQueryDto) {
    const [products, total] = await this.productRepo.findAndCount({
      where: query.search ? { name: ILike(`%${query.search}%`) } : {},
      order: { createdAt: "DESC" },
      ...pageOptions(query),
    });
    return paginate(toDto(ProductResponseDto, products), total, query);
  }

  async getProduct(slug: string) {
    const product = await this.findProduct({ slug });
    return toDto(ProductResponseDto, product);
  }

  async updateProduct(productId: string, productDto: UpdateProductDto) {
    const product = await this.findProduct({ id: productId });
    this.productRepo.merge(product, productDto);
    return toDto(ProductResponseDto, await this.saveProduct(product));
  }

  async deleteProduct(productId: string) {
    const product = await this.findProduct({ id: productId });
    const removed = await this.productRepo.remove(product);
    return toDto(ProductResponseDto, { ...removed, id: productId });
  }
}
