CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  sales_count integer NOT NULL DEFAULT 0 CHECK (sales_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_single_admin_idx
  ON users (role)
  WHERE role = 'ADMIN';

CREATE TABLE IF NOT EXISTS wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_balance bigint NOT NULL DEFAULT 0
    CHECK (available_balance BETWEEN 0 AND 9007199254740991),
  frozen_balance bigint NOT NULL DEFAULT 0
    CHECK (frozen_balance BETWEEN 0 AND 9007199254740991),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_balance + frozen_balance <= 9007199254740991)
);

CREATE TABLE IF NOT EXISTS auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id),
  title varchar(140) NOT NULL,
  description text NOT NULL,
  category varchar(80) NOT NULL,
  product_condition varchar(80) NOT NULL,
  starting_price bigint NOT NULL
    CHECK (starting_price BETWEEN 1 AND 9007199254740991),
  commune varchar(100) NOT NULL,
  delivery_method varchar(160) NOT NULL,
  closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'MATCHING', 'SOLD', 'NO_MATCH')),
  matching_started_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auctions_status_closes_at_idx
  ON auctions (status, closes_at);
CREATE INDEX IF NOT EXISTS auctions_seller_idx ON auctions (seller_id);

CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id),
  bidder_id uuid NOT NULL REFERENCES users(id),
  amount bigint NOT NULL CHECK (amount BETWEEN 1 AND 9007199254740991),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN (
      'ACTIVE', 'REPLACED', 'WITHDRAWN', 'REJECTED', 'EXPIRED', 'WON', 'RELEASED'
    )),
  replaced_by_id uuid REFERENCES bids(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS bids_one_active_per_user_auction_idx
  ON bids (auction_id, bidder_id)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS bids_auction_status_amount_idx
  ON bids (auction_id, status, amount DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS bids_bidder_idx ON bids (bidder_id);

CREATE TABLE IF NOT EXISTS auction_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id),
  bid_id uuid NOT NULL REFERENCES bids(id),
  candidate_id uuid NOT NULL REFERENCES users(id),
  position integer NOT NULL CHECK (position > 0),
  offered_amount bigint NOT NULL
    CHECK (offered_amount BETWEEN 1 AND 9007199254740991),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, position),
  UNIQUE (auction_id, candidate_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS auction_matches_one_pending_idx
  ON auction_matches (auction_id)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS auction_matches_candidate_status_idx
  ON auction_matches (candidate_id, status, expires_at);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL UNIQUE REFERENCES auctions(id),
  match_id uuid NOT NULL UNIQUE REFERENCES auction_matches(id),
  buyer_id uuid NOT NULL REFERENCES users(id),
  seller_id uuid NOT NULL REFERENCES users(id),
  gross_amount bigint NOT NULL CHECK (gross_amount > 0),
  platform_fee bigint NOT NULL CHECK (platform_fee >= 0),
  seller_proceeds bigint NOT NULL CHECK (seller_proceeds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (gross_amount = platform_fee + seller_proceeds)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  entry_type text NOT NULL CHECK (entry_type IN (
    'DEPOSIT', 'WITHDRAWAL', 'BID_HOLD', 'BID_RELEASE',
    'BID_PENALTY', 'PENALTY_RECEIVED', 'PURCHASE',
    'SALE_PROCEEDS', 'PLATFORM_FEE'
  )),
  available_delta bigint NOT NULL DEFAULT 0,
  frozen_delta bigint NOT NULL DEFAULT 0,
  auction_id uuid REFERENCES auctions(id),
  bid_id uuid REFERENCES bids(id),
  match_id uuid REFERENCES auction_matches(id),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_delta <> 0 OR frozen_delta <> 0)
);

CREATE INDEX IF NOT EXISTS ledger_entries_user_created_idx
  ON ledger_entries (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS ledger_entries_auction_idx
  ON ledger_entries (auction_id);

CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entries_immutable_update ON ledger_entries;
CREATE TRIGGER ledger_entries_immutable_update
BEFORE UPDATE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_entries_immutable_delete ON ledger_entries;
CREATE TRIGGER ledger_entries_immutable_delete
BEFORE DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
