import { ClassConstructor, plainToInstance } from "class-transformer";

// overloads so an array in gives an array out
export function toDto<T>(dto: ClassConstructor<T>, data: object[]): T[];
export function toDto<T>(dto: ClassConstructor<T>, data: object): T;
export function toDto<T>(dto: ClassConstructor<T>, data: object | object[]) {
  return plainToInstance(dto, data, { excludeExtraneousValues: true });
}
