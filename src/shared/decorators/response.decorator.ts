import { applyDecorators, type Type } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";

export const ResponseMessage = Reflector.createDecorator<string>();

type EnvelopeOptions = { status: number; message?: string; type?: Type };

// sets the runtime message and documents the same message in Swagger
export const ApiEnvelope = ({
  status,
  message = "Successful",
  type,
}: EnvelopeOptions) =>
  applyDecorators(
    ResponseMessage(message),
    ...(type ? [ApiExtraModels(type)] : []),
    ApiResponse({
      status,
      description: message,
      schema: {
        properties: {
          data: type
            ? { $ref: getSchemaPath(type) }
            : { nullable: true, example: null },
          message: { type: "string", example: message },
          status: { type: "boolean", example: true },
        },
      },
    }),
  );
