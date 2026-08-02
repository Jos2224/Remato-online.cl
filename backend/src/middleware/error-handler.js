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

  // Un fallo de la pasarela no es un error de programación: decirle "error interno" a
  // quien intenta pagar oculta la causa y hace imposible diagnosticarlo. El detalle
  // técnico va al registro; a la persona se le dice que el pago no pudo iniciarse.
  if (error?.name === 'FlowError') {
    console.error('[flow]', error.status, error.code, error.message, error.body ?? '');
    return response.status(502).json({
      error: {
        code: 'PAYMENT_GATEWAY_ERROR',
        message: 'No pudimos iniciar el pago con la pasarela. Intenta nuevamente en unos minutos.',
        details: { providerCode: error.code ?? null },
      },
    });
  }

  // Un tiempo de espera agotado hacia la pasarela tampoco es un 500 nuestro.
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return response.status(504).json({
      error: { code: 'GATEWAY_TIMEOUT', message: 'La pasarela de pagos no respondió a tiempo.' },
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
