import { z, ZodError } from 'zod';
import { MAX_MONEY } from '../domain/money.js';
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

// Money is always a whole number of Chilean pesos. Spelled out explicitly because the
// default Zod message ("Expected integer, received float") is English and tells the
// user nothing about why 50.000,5 was rejected.
export function moneySchema(field = 'El monto') {
  return z
    .number({
      required_error: `Debes indicar ${field.toLowerCase()}.`,
      invalid_type_error: `${field} debe ser un número.`,
    })
    .int(`${field} debe ser un monto entero en pesos, sin decimales.`)
    .positive(`${field} debe ser mayor que $0.`)
    .max(MAX_MONEY, `${field} supera el máximo permitido.`);
}

export function isZodError(error) {
  return error instanceof ZodError;
}
