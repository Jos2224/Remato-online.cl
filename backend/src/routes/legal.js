import { Router } from 'express';
import { z } from 'zod';
import { LEGAL_DOCUMENTS, findDocument } from '../domain/legal.js';
import { asyncHandler } from '../lib/async-handler.js';
import { notFound } from '../lib/api-error.js';
import { validate } from '../lib/validation.js';
import { requireAuth } from '../middleware/auth.js';
import {
  acceptanceHistory,
  pendingDocuments,
  recordAcceptance,
  signatureEvidence,
} from '../services/legal.js';

const router = Router();

const summarise = (document) => ({
  slug: document.slug,
  version: document.version,
  title: document.title,
  summary: document.summary,
  requiredFor: document.requiredFor,
  contentHash: document.contentHash,
});

// El catálogo y el texto son públicos: nadie debería tener que registrarse para leer las
// condiciones a las que se le pedirá adherir.
router.get(
  '/',
  asyncHandler(async (_request, response) => {
    response.json({ data: { documents: LEGAL_DOCUMENTS.map(summarise) } });
  }),
);

// Documentos que la persona autenticada aún debe firmar para un contexto dado.
router.get(
  '/pending/:context',
  requireAuth,
  asyncHandler(async (request, response) => {
    const { context } = validate(
      z.object({ context: z.enum(['REGISTRATION', 'PUBLISH', 'BID']) }),
      request.params,
    );
    const pending = await pendingDocuments(request.user.id, context);
    response.json({ data: { pending: pending.map(summarise) } });
  }),
);

// Firma explícita, fuera del flujo de una operación (por ejemplo, al aceptar una versión
// nueva desde la propia cuenta).
router.post(
  '/accept',
  requireAuth,
  asyncHandler(async (request, response) => {
    const input = validate(
      z.object({
        slug: z.string().trim().min(1, 'Indica el documento a aceptar.'),
        context: z.enum(['REGISTRATION', 'PUBLISH', 'BID']),
      }),
      request.body,
    );

    const result = await recordAcceptance({
      userId: request.user.id,
      slug: input.slug,
      context: input.context,
      evidence: signatureEvidence(request),
    });

    response.status(result.alreadyAccepted ? 200 : 201).json({
      data: {
        accepted: true,
        alreadyAccepted: result.alreadyAccepted,
        slug: result.document.slug,
        version: result.document.version,
      },
    });
  }),
);

// Historial de firmas de la persona: qué aceptó, en qué versión y cuándo.
router.get(
  '/me/history',
  requireAuth,
  asyncHandler(async (request, response) => {
    response.json({ data: { acceptances: await acceptanceHistory(request.user.id) } });
  }),
);

// Declarada al final a propósito: '/:slug' es un comodín y, puesta antes, capturaría
// '/pending/...' y '/me/history' como si fueran nombres de documento.
router.get(
  '/:slug',
  asyncHandler(async (request, response) => {
    const document = findDocument(request.params.slug);
    if (!document) throw notFound('Documento legal no encontrado.');
    response.json({ data: { document: { ...summarise(document), body: document.body } } });
  }),
);

export default router;
