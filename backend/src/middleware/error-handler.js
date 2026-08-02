import { ApiError } from '../lib/api-error.js';

export function notFoundHandler(_request, _response, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada.'));
}

export function errorHandler(error, _request, response, _next) {
  if (error instanceof ApiError) {
    const body = {
      error: {
        code: error.code,
        message: error.message,
      },
    };
    if (error.details !== undefined) body.error.details = error.details;
    return response.status(error.status).json(body);
  }

  if (error?.code === '23505') {
    return response.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'El recurso ya existe o entra en conflicto con otro.',
      },
    });
  }

  if (error?.code === '22P02') {
    return response.status(400).json({
      error: { code: 'INVALID_IDENTIFIER', message: 'El identificador no es válido.' },
    });
  }

  if (error?.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'El cuerpo JSON no es válido.' },
    });
  }

  if (error?.type === 'entity.too.large') {
    return response.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo de la solicitud es demasiado grande.' },
    });
  }

  console.error(error);
  return response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error interno.',
    },
  });
}
