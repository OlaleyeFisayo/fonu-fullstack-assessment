import { UserRole } from "../../user/entities/user.entity";

export class LoginResponseDto {
  name: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
}
