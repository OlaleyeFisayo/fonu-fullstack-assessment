import { ConflictException } from "@nestjs/common";
import { QueryFailedError } from "typeorm";

export async function saveUnique<T>(save: () => Promise<T>, message: string) {
  try {
    return await save();
  } catch (error) {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === "23505"
    )
      throw new ConflictException(message);
    throw error;
  }
}
