import { ClassConstructor, plainToInstance } from "class-transformer";

export function toDto<T>(dto: ClassConstructor<T>, data: object[]): T[];
export function toDto<T>(dto: ClassConstructor<T>, data: object): T;
export function toDto<T>(dto: ClassConstructor<T>, data: object | object[]) {
  return plainToInstance(dto, data, { excludeExtraneousValues: true });
}
