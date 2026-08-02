-- Partial holds, optional product images and e-mail verification.

-- 1. Partial holds change how a penalty is recorded.
--
-- A bid now freezes only a deposit (a percentage of the offer) instead of the whole
-- amount. When a matched bidder walks away that deposit is forfeited and split between
-- the seller — who is the party actually harmed by the failed sale — and the platform.
-- The seller's share needs its own ledger type so the books stay readable.
ALTER TABLE ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_entry_type_check;
ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_entry_type_check
  CHECK (entry_type IN (
    'DEPOSIT', 'WITHDRAWAL', 'BID_HOLD', 'BID_RELEASE',
    'BID_PENALTY', 'PENALTY_RECEIVED', 'PENALTY_TO_SELLER',
    'PURCHASE', 'SALE_PROCEEDS', 'PLATFORM_FEE'
  ));

-- How much of each bid is actually frozen, recorded per bid so that historical bids keep
-- the rule that applied when they were placed even if the percentage changes later.
ALTER TABLE bids ADD COLUMN IF NOT EXISTS held_amount bigint;
UPDATE bids SET held_amount = amount WHERE held_amount IS NULL;
ALTER TABLE bids ALTER COLUMN held_amount SET NOT NULL;
ALTER TABLE bids ADD CONSTRAINT bids_held_amount_check
  CHECK (held_amount BETWEEN 0 AND amount);

-- 2. Optional product image. One image per auction, stored on disk; the column holds the
-- file name only, so the serving path can change without a data migration.
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS image_filename text;

-- 3. E-mail verification. Nullable throughout: when no mail transport is configured the
-- application leaves accounts verified and this stays unused.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at timestamptz;

-- Existing accounts predate verification, so they are grandfathered in rather than
-- being locked out of a marketplace they already use.
UPDATE users SET email_verified_at = now() WHERE email_verified_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_verification_token_idx
  ON users (email_verification_token)
  WHERE email_verification_token IS NOT NULL;
