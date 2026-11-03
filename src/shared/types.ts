import { UserRole } from "../features/user/entities/user.entity";

export type JwtPayload = {
  userId: string;
  role: UserRole;
};
