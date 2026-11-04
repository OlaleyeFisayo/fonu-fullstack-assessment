import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { hash, verify } from "argon2";
import { FindOptionsWhere, Repository } from "typeorm";
import type { EnvConfigService } from "../../shared/env";
import { JwtPayload } from "../../shared/types";
import { saveUnique } from "../../shared/utils/saveUnique";
import { User } from "../user/entities/user.entity";
import { LoginDto } from "./dtos/login.dto";
import { LoginResponseDto } from "./dtos/loginResponse.dto";
import { SignUpDto } from "./dtos/signUp.dto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
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

  private async generateAuthTokens(payload: JwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.sign(payload),
      this.jwtService.sign(payload, {
        secret: this.config.get("REFRESH_TOKEN_SECRET"),
        expiresIn: this.config.get("REFRESH_TOKEN_EXPIRES_IN"),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async verifyRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<JwtPayload> {
    try {
      await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get("REFRESH_TOKEN_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid Refresh Token");
    }

    const user = await this.findUser({ id: userId });
    if (
      !user.hashedRefreshToken ||
      !(await verify(user.hashedRefreshToken, refreshToken))
    ) {
      throw new UnauthorizedException("Invalid Refresh Token");
    }

    return { userId, role: user.role };
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

    await this.userRepo.update(
      { id: user.id },
      { hashedRefreshToken: await hash(refreshToken) },
    );

    return {
      name: user.name,
      role: user.role,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(payload: JwtPayload) {
    const { accessToken, refreshToken } =
      await this.generateAuthTokens(payload);
    await this.userRepo.update(
      { id: payload.userId },
      { hashedRefreshToken: await hash(refreshToken) },
    );
    return {
      accessToken,
      refreshToken,
    };
  }

  async logout(userId: string) {
    await this.userRepo.update({ id: userId }, { hashedRefreshToken: null });
  }
}
