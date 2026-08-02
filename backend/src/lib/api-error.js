export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) =>
  new ApiError(400, code, message, details);

export const unauthorized = (message = 'Debes iniciar sesión.') =>
  new ApiError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'No tienes permiso para realizar esta acción.') =>
  new ApiError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Recurso no encontrado.') =>
  new ApiError(404, 'NOT_FOUND', message);

export const conflict = (code, message, details) =>
  new ApiError(409, code, message, details);
