import { applyDecorators, type Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";

export const ResponseMessage = Reflector.createDecorator<string>();

type EnvelopeOptions = {
  status: number;
  message?: string;
  type?: Type;
  isArray?: boolean;
  paginated?: boolean;
};

const metaNumber = (example: number) => ({ type: "number", example });

const dataSchema = (
  type: Type | undefined,
  isArray: boolean,
  paginated: boolean,
) => {
  if (!type) return { nullable: true, example: null };
  const ref = { $ref: getSchemaPath(type) };
  if (paginated)
    return {
      type: "object",
      properties: {
        items: { type: "array", items: ref },
        meta: {
          type: "object",
          properties: {
            page: metaNumber(1),
            limit: metaNumber(10),
            totalItems: metaNumber(42),
            totalPages: metaNumber(5),
          },
        },
      },
    };
  return isArray ? { type: "array", items: ref } : ref;
};

// sets the runtime message and documents the same message in Swagger
export const ApiEnvelope = ({
  status,
  message = "Successful",
  type,
  isArray = false,
  paginated = false,
}: EnvelopeOptions) =>
  applyDecorators(
    ResponseMessage(message),
    ...(type ? [ApiExtraModels(type)] : []),
    ApiResponse({
      status,
      description: message,
      schema: {
        properties: {
          data: dataSchema(type, isArray, paginated),
          message: { type: "string", example: message },
          status: { type: "boolean", example: true },
        },
      },
    }),
  );
