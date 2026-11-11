import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { EnvConfigService } from "../../../shared/env";
import { AuthUser, JwtPayload } from "../../../shared/types";
import { AuthService } from "../auth.service";
import { TokenType } from "../entities/token.entity";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    @Inject(ConfigService) config: EnvConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get("ACCESS_TOKEN_SECRET"),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const { userId, role, jti, sid } = payload;
    if (
      !jti ||
      !sid ||
      !(await this.authService.isTokenActive(jti, TokenType.ACCESS))
    )
      throw new UnauthorizedException("Token has been revoked");

    return { userId, role, jti, sid };
  }
}
