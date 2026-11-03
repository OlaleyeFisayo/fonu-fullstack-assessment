import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import type { EnvConfigService } from "../../../shared/env";
import { User } from "../../user/entities/user.entity";
import { Product, slugify } from "../entities/product.entity";

const PRODUCTS = [
  {
    name: "Wireless Mouse",
    description: "Ergonomic 2.4GHz mouse",
    price: 25.99,
    stock: 120,
  },
  {
    name: "Mechanical Keyboard",
    description: "Hot-swappable, brown switches",
    price: 89.5,
    stock: 45,
  },
  {
    name: '27" Monitor',
    description: "1440p IPS, 144Hz",
    price: 299.0,
    stock: 20,
  },
  {
    name: "USB-C Hub",
    description: "7-in-1 with HDMI and PD charging",
    price: 39.99,
    stock: 80,
  },
  {
    name: "Laptop Stand",
    description: "Adjustable aluminium stand",
    price: 34.0,
    stock: 60,
  },
];

@Injectable()
export class ProductSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProductSeeder.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(ConfigService) private readonly config: EnvConfigService,
  ) {}

  async onApplicationBootstrap() {
    const existing = await this.productRepo.find({
      select: { slug: true },
      where: { slug: In(PRODUCTS.map((p) => slugify(p.name))) },
    });
    const taken = new Set(existing.map((p) => p.slug));
    const missing = PRODUCTS.filter((p) => !taken.has(slugify(p.name)));
    if (!missing.length) return;

    const admin = await this.userRepo.findOneByOrFail({
      email: this.config.get("ADMIN_EMAIL"),
    });

    await this.productRepo.save(
      missing.map((p) => this.productRepo.create({ ...p, createdBy: admin })),
    );
    this.logger.log(`Seeded ${missing.length} products`);
  }
}
