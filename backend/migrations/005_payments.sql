-- Pagos con pasarela (Flow).
--
-- Un abono deja de ser autodeclarado: el saldo sólo sube cuando Flow confirma que el
-- dinero entró. La tabla es el registro de esa negociación.
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL DEFAULT 'FLOW',

  -- Nuestro identificador de la orden, el que viaja a Flow. Único: es la clave sobre la
  -- que descansa la idempotencia, porque Flow reintenta el callback de confirmación y el
  -- mismo pago no puede acreditarse dos veces.
  commerce_order text NOT NULL,

  -- Identificadores que devuelve Flow.
  flow_order text,
  token text,

  -- Pesos chilenos, enteros. Sin decimales: la moneda no los tiene y el redondeo cerca
  -- del dinero es una fuente clásica de descuadres.
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 9007199254740991),

  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PAID', 'REJECTED', 'CANCELLED')),

  -- Momento exacto en que el saldo se acreditó. NULL mientras no se haya acreditado; es
  -- lo que impide acreditar dos veces aunque el callback llegue repetido.
  credited_at timestamptz,

  -- Última respuesta de payment/getStatus, para poder auditar una disputa.
  provider_status jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_commerce_order_idx
  ON payments (commerce_order);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_token_idx ON payments (token);

-- El abono acreditado queda además en el libro mayor, que ya es inmutable.
