import { pool } from '../db/pool.js';
import { badRequest, forbidden } from '../lib/api-error.js';
import { documentsRequiredFor, findDocument } from '../domain/legal.js';

// La dirección IP y el agente de usuario son parte de la evidencia del acto de firma.
// Se toman del request, nunca del cuerpo enviado por el cliente.
export function signatureEvidence(request) {
  return {
    ip: request.ip ?? null,
    userAgent: String(request.get('user-agent') ?? '').slice(0, 500) || null,
  };
}

// Devuelve los documentos exigidos para un contexto que la persona todavía NO ha
// aceptado en su versión vigente. Una versión nueva vuelve a aparecer como pendiente.
export async function pendingDocuments(userId, context, db = pool) {
  const required = documentsRequiredFor(context);
  if (required.length === 0) return [];

  const accepted = await db.query(
    `SELECT document_slug, document_version
     FROM legal_acceptances
     WHERE user_id = $1 AND document_slug = ANY($2::text[])`,
    [userId, required.map((document) => document.slug)],
  );

  const signed = new Set(
    accepted.rows.map((row) => `${row.document_slug}@${row.document_version}`),
  );
  return required.filter((document) => !signed.has(`${document.slug}@${document.version}`));
}

// Registra la firma. Idempotente: volver a aceptar la misma versión no duplica la
// evidencia, porque la primera manifestación de voluntad es la que vale.
export async function recordAcceptance(
  { userId, slug, context, auctionId = null, evidence },
  db = pool,
) {
  const document = findDocument(slug);
  if (!document) throw badRequest('UNKNOWN_DOCUMENT', 'Documento legal desconocido.');
  if (!document.requiredFor.includes(context)) {
    throw badRequest(
      'DOCUMENT_NOT_APPLICABLE',
      'Ese documento no corresponde a esta operación.',
    );
  }

  const existing = await db.query(
    `SELECT 1 FROM legal_acceptances
     WHERE user_id = $1 AND document_slug = $2 AND document_version = $3
     LIMIT 1`,
    [userId, document.slug, document.version],
  );
  if (existing.rowCount > 0) return { alreadyAccepted: true, document };

  await db.query(
    `INSERT INTO legal_acceptances
      (user_id, document_slug, document_version, content_hash,
       context, auction_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      document.slug,
      document.version,
      document.contentHash,
      context,
      auctionId,
      evidence?.ip ?? null,
      evidence?.userAgent ?? null,
    ],
  );
  return { alreadyAccepted: false, document };
}

// Firma en bloque los documentos de un contexto. `accepted` es la lista de slugs que la
// persona marcó en pantalla: se exige que estén TODOS los pendientes, para que marcar
// una casilla no pueda dar por firmado un documento que nunca se mostró.
export async function requireAcceptance(
  { userId, context, accepted = [], auctionId = null, evidence },
  db = pool,
) {
  const pending = await pendingDocuments(userId, context, db);
  if (pending.length === 0) return [];

  const marked = new Set(Array.isArray(accepted) ? accepted : []);
  const missing = pending.filter((document) => !marked.has(document.slug));
  if (missing.length > 0) {
    throw forbidden(
      `Debes aceptar: ${missing.map((document) => document.title).join(', ')}.`,
    );
  }

  const signed = [];
  for (const document of pending) {
    await recordAcceptance(
      { userId, slug: document.slug, context, auctionId, evidence },
      db,
    );
    signed.push(document.slug);
  }
  return signed;
}

export async function acceptanceHistory(userId, db = pool) {
  const result = await db.query(
    `SELECT document_slug, document_version, content_hash, context,
            auction_id, accepted_at
     FROM legal_acceptances
     WHERE user_id = $1
     ORDER BY accepted_at DESC, id DESC`,
    [userId],
  );
  return result.rows.map((row) => ({
    slug: row.document_slug,
    version: row.document_version,
    contentHash: row.content_hash,
    context: row.context,
    auctionId: row.auction_id,
    acceptedAt: row.accepted_at,
    title: findDocument(row.document_slug)?.title ?? row.document_slug,
  }));
}
