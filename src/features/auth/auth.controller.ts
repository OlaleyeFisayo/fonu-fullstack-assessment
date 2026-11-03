import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ApiEnvelope } from "../../shared/decorators/response.decorator";
import { JwtPayload } from "../../shared/types";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dtos/login.dto";
import { LoginResponseDto } from "./dtos/loginResponse.dto";
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from "./dtos/refreshToken.dto";
import { SignUpDto } from "./dtos/signUp.dto";
import { JwtAuthGuard } from "./guards/jwtAuthGuard";
import { RefreshJwtAuthGuard } from "./guards/refreshJwtAuthGuard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("/signup")
  @ApiEnvelope({ status: 201, message: "Account created" })
  @ApiConflictResponse({ description: "Email already in use" })
  async signup(@Body() signUpDto: SignUpDto) {
    return await this.authService.signUp(signUpDto);
  }

  @Post("/login")
  @HttpCode(HttpStatus.OK)
  @ApiEnvelope({
    status: 200,
    message: "Login successful",
    type: LoginResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return await this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("/logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiEnvelope({ status: 200, message: "Logged out" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  async logout(@Req() req: { user: JwtPayload }) {
    return await this.authService.logout(req.user.userId);
  }

  @UseGuards(RefreshJwtAuthGuard)
  @Post("/refresh")
  @HttpCode(HttpStatus.OK)
  @ApiEnvelope({
    status: 200,
    message: "Token refreshed",
    type: RefreshTokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Invalid refresh token" })
  async refreshToken(
    @Body() _body: RefreshTokenDto,
    @Req() req: { user: JwtPayload },
  ): Promise<RefreshTokenResponseDto> {
    return await this.authService.refreshToken(req.user);
  }
}
