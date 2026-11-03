import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "type-envgen";
import { AppController } from "./app.controller";
import { AuthModule } from "./features/auth/auth.module";
import { dbFactory } from "./shared/configs/db.config";
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
      useFactory: dbFactory,
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
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
