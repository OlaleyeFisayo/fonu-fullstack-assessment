import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../user/entities/user.entity";
import { Product } from "./entities/product.entity";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { ProductSeeder } from "./seeders/product.seeder";

@Module({
  imports: [TypeOrmModule.forFeature([Product, User])],
  providers: [ProductSeeder, ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
