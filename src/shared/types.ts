import { UserRole } from "../features/user/entities/user.entity";

export type JwtPayload = {
  userId: string;
  role: UserRole;
  sid?: string;
  jti?: string;
};

export type AuthUser = JwtPayload & Required<Pick<JwtPayload, "jti" | "sid">>;
