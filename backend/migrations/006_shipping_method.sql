-- Método de envío declarado por quien vende.
--
-- Hasta ahora la entrega era un texto libre ("delivery_method"), que sirve para explicar
-- detalles pero no para que el sistema sepa nada. Con un campo estructurado la
-- publicación puede mostrar un sello veraz, y es el punto donde más adelante enchufa la
-- integración con el courier (cotización y número de seguimiento).
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS shipping_method text NOT NULL DEFAULT 'PICKUP'
  CHECK (shipping_method IN ('PICKUP', 'CHILEXPRESS'));

-- Costo de despacho en pesos enteros. NULL cuando es retiro en persona, o cuando quien
-- vende aún no lo define. Nunca decimales: la moneda no los tiene.
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS shipping_cost bigint
  CHECK (shipping_cost IS NULL OR (shipping_cost >= 0 AND shipping_cost <= 9007199254740991));

-- Coherencia: no tiene sentido un costo de despacho en una publicación de sólo retiro.
ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_shipping_cost_consistency;
ALTER TABLE auctions ADD CONSTRAINT auctions_shipping_cost_consistency
  CHECK (shipping_method = 'CHILEXPRESS' OR shipping_cost IS NULL);

-- Seguimiento del envío, una vez que exista integración con el courier. Se agrega ahora
-- para que la tabla no tenga que migrar de nuevo cuando llegue.
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS shipping_tracking_code text;

CREATE INDEX IF NOT EXISTS auctions_shipping_method_idx ON auctions (shipping_method);
