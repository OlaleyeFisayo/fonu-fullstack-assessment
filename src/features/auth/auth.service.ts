import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { verify } from "argon2";
import {
  EntityManager,
  FindOptionsWhere,
  IsNull,
  MoreThan,
  Repository,
} from "typeorm";
import type { EnvConfigService } from "../../shared/env";
import { AuthUser, JwtPayload } from "../../shared/types";
import { saveUnique } from "../../shared/utils/saveUnique";
import { User } from "../user/entities/user.entity";
import { LoginDto } from "./dtos/login.dto";
import { LoginResponseDto } from "./dtos/loginResponse.dto";
import { SignUpDto } from "./dtos/signUp.dto";
import { Token, TokenType } from "./entities/token.entity";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Token) private readonly tokenRepo: Repository<Token>,
    private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly config: EnvConfigService,
  ) {}

  private async findUser(where: FindOptionsWhere<User>) {
    const user = await this.userRepo.findOneBy(where);
    if (!user) throw new NotFoundException("User does not exist");
    return user;
  }

  private async validateUser(email: string, password: string) {
    const user = await this.findUser({ email });

    if (!(await verify(user.password, password)))
      throw new UnauthorizedException("Invalid Credentials");

    return user;
  }

  private expiresAt(token: string) {
    const { exp } = this.jwtService.decode<{ exp: number }>(token);
    return new Date(exp * 1000);
  }

  private async generateAuthTokens(
    { userId, role }: JwtPayload,
    sessionId: string = randomUUID(),
    manager: EntityManager = this.tokenRepo.manager,
  ) {
    const claims = { userId, role, sid: sessionId };
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = this.jwtService.sign(claims, { jwtid: accessJti });
    const refreshToken = this.jwtService.sign(claims, {
      jwtid: refreshJti,
      secret: this.config.get("REFRESH_TOKEN_SECRET"),
      expiresIn: this.config.get("REFRESH_TOKEN_EXPIRES_IN"),
    });

    await manager.insert(Token, [
      {
        id: accessJti,
        sessionId,
        user: { id: userId },
        type: TokenType.ACCESS,
        expiresAt: this.expiresAt(accessToken),
      },
      {
        id: refreshJti,
        sessionId,
        user: { id: userId },
        type: TokenType.REFRESH,
        expiresAt: this.expiresAt(refreshToken),
      },
    ]);

    return { accessToken, refreshToken };
  }

  private revokeWhere(
    where: FindOptionsWhere<Token>,
    manager: EntityManager = this.tokenRepo.manager,
  ) {
    return manager.update(
      Token,
      { ...where, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async isTokenActive(jti: string, type: TokenType) {
    return await this.tokenRepo.exists({
      where: {
        id: jti,
        type,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async verifyRefreshToken(claims: JwtPayload): Promise<AuthUser> {
    const { userId, jti, sid } = claims;
    if (!jti || !sid) throw new UnauthorizedException("Invalid Refresh Token");

    const token = await this.tokenRepo.findOne({
      where: { id: jti, type: TokenType.REFRESH, user: { id: userId } },
    });
    if (!token) throw new UnauthorizedException("Invalid Refresh Token");

    if (token.revokedAt) {
      await this.revokeWhere({ user: { id: userId } });
      throw new UnauthorizedException("Invalid Refresh Token");
    }

    const user = await this.findUser({ id: userId });
    return { userId, role: user.role, jti, sid };
  }

  async signUp(signUpDto: SignUpDto) {
    const newUser = this.userRepo.create(signUpDto);
    await saveUnique(
      () => this.userRepo.save(newUser),
      "User with this email already exists",
    );
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    const { accessToken, refreshToken } = await this.generateAuthTokens({
      userId: user.id,
      role: user.role,
    });

    return {
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken({ userId, role, jti, sid }: AuthUser) {
    return await this.tokenRepo.manager.transaction(async (manager) => {
      const claimed = await this.revokeWhere({ id: jti }, manager);
      if (claimed.affected !== 1)
        throw new UnauthorizedException("Invalid Refresh Token");

      await this.revokeWhere({ sessionId: sid }, manager);
      return await this.generateAuthTokens({ userId, role }, sid, manager);
    });
  }

  async logout(sessionId: string) {
    await this.revokeWhere({ sessionId });
  }
}
