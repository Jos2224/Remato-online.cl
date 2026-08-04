-- Búsqueda del catálogo dentro de la base de datos.
--
-- Hasta ahora la portada pedía las 100 publicaciones más recientes y filtraba con un
-- `includes()` en el navegador. Eso no encuentra "camion" cuando el título dice "camión",
-- no perdona una errata, y sobre todo no puede paginar: lo que no venía en esas 100 no
-- existía para quien buscaba. La búsqueda se mueve al motor, que es donde están los datos.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- `unaccent(text)` es STABLE y por eso no sirve para indexar. La forma de dos argumentos
-- sí es IMMUTABLE; este envoltorio la fija al diccionario público.
CREATE OR REPLACE FUNCTION remato_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Documento ponderado para la relevancia: el título pesa más que la categoría o la
-- comuna, y ésas más que la descripción. Sin los pesos, una descripción larga que
-- menciona la palabra al pasar le gana a la publicación que se llama exactamente así.
CREATE OR REPLACE FUNCTION remato_auction_search_vector(
  in_title text,
  in_description text,
  in_category text,
  in_condition text,
  in_commune text
) RETURNS tsvector
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT
    setweight(to_tsvector('spanish', remato_unaccent(coalesce(in_title, ''))), 'A') ||
    setweight(
      to_tsvector(
        'spanish',
        remato_unaccent(
          coalesce(in_category, '') || ' ' || coalesce(in_condition, '') || ' ' || coalesce(in_commune, '')
        )
      ),
      'B'
    ) ||
    setweight(to_tsvector('spanish', remato_unaccent(coalesce(in_description, ''))), 'C')
$$;

-- Texto plano para tolerar erratas por trigramas. Deliberadamente NO incluye la
-- descripción: son hasta 10.000 caracteres por publicación y el índice crecería sin dar
-- mejor resultado, porque quien escribe mal escribe mal el nombre de la cosa.
CREATE OR REPLACE FUNCTION remato_auction_search_terms(
  in_title text,
  in_category text,
  in_condition text,
  in_commune text
) RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT remato_unaccent(lower(
    coalesce(in_title, '') || ' ' || coalesce(in_category, '') || ' ' ||
    coalesce(in_condition, '') || ' ' || coalesce(in_commune, '')
  ))
$$;

-- Tabla aparte, no columnas en `auctions`. Media aplicación lee la subasta con
-- `SELECT a.*`; si el tsvector viviera ahí, cada lectura de cada publicación arrastraría
-- el índice invertido de una descripción de 10.000 caracteres sin que nadie lo use.
CREATE TABLE IF NOT EXISTS auction_search (
  auction_id uuid PRIMARY KEY REFERENCES auctions(id) ON DELETE CASCADE,
  search_vector tsvector NOT NULL,
  search_terms text NOT NULL
);

CREATE INDEX IF NOT EXISTS auction_search_vector_idx
  ON auction_search USING gin (search_vector);
CREATE INDEX IF NOT EXISTS auction_search_terms_trgm_idx
  ON auction_search USING gin (search_terms gin_trgm_ops);

CREATE OR REPLACE FUNCTION remato_sync_auction_search() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO auction_search (auction_id, search_vector, search_terms)
  VALUES (
    NEW.id,
    remato_auction_search_vector(
      NEW.title, NEW.description, NEW.category, NEW.product_condition, NEW.commune
    ),
    remato_auction_search_terms(
      NEW.title, NEW.category, NEW.product_condition, NEW.commune
    )
  )
  ON CONFLICT (auction_id) DO UPDATE
    SET search_vector = EXCLUDED.search_vector,
        search_terms = EXCLUDED.search_terms;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS auctions_search_sync ON auctions;
CREATE TRIGGER auctions_search_sync
  AFTER INSERT OR UPDATE OF title, description, category, product_condition, commune
  ON auctions
  FOR EACH ROW
  EXECUTE FUNCTION remato_sync_auction_search();

-- Carga inicial de lo ya publicado.
INSERT INTO auction_search (auction_id, search_vector, search_terms)
SELECT
  a.id,
  remato_auction_search_vector(a.title, a.description, a.category, a.product_condition, a.commune),
  remato_auction_search_terms(a.title, a.category, a.product_condition, a.commune)
FROM auctions a
ON CONFLICT (auction_id) DO UPDATE
  SET search_vector = EXCLUDED.search_vector,
      search_terms = EXCLUDED.search_terms;

-- El orden por antigüedad y los filtros por categoría o estado del producto ahora se
-- resuelven en el servidor, porque la portada pagina: ordenar sólo la página visible
-- daría un orden falso.
CREATE INDEX IF NOT EXISTS auctions_status_created_at_idx ON auctions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS auctions_category_idx ON auctions (category);
CREATE INDEX IF NOT EXISTS auctions_condition_idx ON auctions (product_condition);
