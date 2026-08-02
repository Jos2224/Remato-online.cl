import { ZodError } from 'zod';
import { ApiError } from './api-error.js';

export function validate(schema, value) {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Hay datos inválidos.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  return result.data;
}

export function isZodError(error) {
  return error instanceof ZodError;
}
