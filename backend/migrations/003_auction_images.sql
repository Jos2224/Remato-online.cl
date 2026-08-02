-- Multiple photos per auction.
--
-- A single image column could not express a gallery, and buyers judge a used product
-- from several angles. Ordering is explicit so the seller controls which photo leads.
CREATE TABLE IF NOT EXISTS auction_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  filename text NOT NULL,
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auction_images_auction_idx
  ON auction_images (auction_id, position, created_at);

-- Carry over the single image each auction may already have, as the first photo.
INSERT INTO auction_images (auction_id, filename, position)
SELECT id, image_filename, 0
FROM auctions
WHERE image_filename IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auction_images existing WHERE existing.auction_id = auctions.id
  );

-- The old column is now a second source of truth for the same fact, so it goes.
ALTER TABLE auctions DROP COLUMN IF EXISTS image_filename;
