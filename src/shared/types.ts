import { UserRole } from "../features/user/entities/user.entity";

export type TokenClaims = {
  userId: string;
  role: UserRole;
};

export type JwtPayload = TokenClaims & {
  sid: string;
  jti: string;
};
