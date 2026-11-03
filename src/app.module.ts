import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "type-envgen";
import { AppController } from "./app.controller";
import { AuthModule } from "./features/auth/auth.module";
import { CartModule } from "./features/cart/cart.module";
import { OrderModule } from "./features/order/order.module";
import { ProductModule } from "./features/product/product.module";
import { UserModule } from "./features/user/user.module";
import { typeOrmFactory } from "./shared/configs/typeOrm.config";
import { EnvConfigService, envSchema } from "./shared/env";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => validateEnv(envSchema, config),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmFactory,
    }),
    PassportModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: EnvConfigService) => ({
        secret: config.get("ACCESS_TOKEN_SECRET"),
        signOptions: {
          expiresIn: config.get("ACCESS_TOKEN_EXPIRES_IN"),
        },
      }),
    }),
    AuthModule,
    UserModule,
    ProductModule,
    OrderModule,
    CartModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
