import { Reflector } from "@nestjs/core";
import { UserRole } from "../entities/user.entity";

export const Roles = Reflector.createDecorator<UserRole[]>();
