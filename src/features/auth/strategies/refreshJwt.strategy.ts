import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { EnvConfigService } from "../../../shared/env";
import { JwtPayload } from "../../../shared/types";
import { AuthService } from "../auth.service";

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  "refreshJwt",
) {
  constructor(
    @Inject(ConfigService) private readonly config: EnvConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      secretOrKey: config.get("REFRESH_TOKEN_SECRET"),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const userId = payload.userId;
    const refreshToken = (req.body as { refreshToken: string }).refreshToken;
    return await this.authService.verifyRefreshToken(userId, refreshToken);
  }
}
