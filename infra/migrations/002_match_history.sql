BEGIN;
CREATE TABLE match_history (
  installation_id text NOT NULL REFERENCES installations(id),
  match_key text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload_encrypted text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, match_key)
);
CREATE INDEX match_history_occurred_idx ON match_history (installation_id, occurred_at DESC);
CREATE TABLE history_viewers (
  installation_id text PRIMARY KEY REFERENCES installations(id),
  secret_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE history_sessions (
  session_hash text PRIMARY KEY,
  installation_id text NOT NULL REFERENCES installations(id),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
COMMIT;
