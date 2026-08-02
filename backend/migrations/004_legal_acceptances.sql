-- Registro de aceptación de documentos legales (firma electrónica simple).
--
-- La Ley 19.799 reconoce valor probatorio a la firma electrónica simple cuando consta
-- quién manifestó su voluntad, sobre qué documento y en qué momento. Por eso cada fila
-- guarda no sólo el consentimiento, sino el hash del texto exacto que se aceptó: si el
-- documento cambia después, sigue siendo posible demostrar qué se firmó.
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  document_slug text NOT NULL,
  document_version text NOT NULL,
  -- SHA-256 del cuerpo del documento en el momento de la aceptación.
  content_hash text NOT NULL,
  context text NOT NULL CHECK (context IN ('REGISTRATION', 'PUBLISH', 'BID')),
  -- Contexto concreto, cuando la firma acompaña a una operación puntual.
  auction_id uuid REFERENCES auctions(id),
  -- Evidencia del acto: desde dónde y con qué cliente se manifestó la voluntad.
  ip_address text,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx
  ON legal_acceptances (user_id, document_slug, document_version);
CREATE INDEX IF NOT EXISTS legal_acceptances_auction_idx
  ON legal_acceptances (auction_id);

-- Una aceptación es prueba: se agrega, nunca se altera ni se borra. Mismo criterio que
-- el libro de movimientos de saldo.
CREATE OR REPLACE FUNCTION prevent_legal_acceptance_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'legal_acceptances is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS legal_acceptances_immutable ON legal_acceptances;
CREATE TRIGGER legal_acceptances_immutable
  BEFORE UPDATE OR DELETE ON legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION prevent_legal_acceptance_mutation();
