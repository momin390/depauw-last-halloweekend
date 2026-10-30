CREATE TABLE IF NOT EXISTS game_rooms (
 code text PRIMARY KEY,
 create_key text UNIQUE NOT NULL,
 state jsonb NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS game_rooms_expiry ON game_rooms(expires_at);
