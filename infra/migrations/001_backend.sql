BEGIN;
CREATE TABLE installations (
  id text PRIMARY KEY,
  credential_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  last_seen_at timestamptz
);
CREATE TABLE analyses (
  id text PRIMARY KEY,
  installation_id text NOT NULL REFERENCES installations(id),
  idempotency_key_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted','queued','processing','validating','retry_wait','completed','failed','expired','deleted')),
  schema_version integer NOT NULL,
  result_version integer,
  receipt_hash text NOT NULL UNIQUE,
  input_payload_encrypted text,
  aggregate_metrics jsonb,
  result_payload jsonb,
  error_code text,
  retryable boolean,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  input_expires_at timestamptz NOT NULL,
  result_expires_at timestamptz NOT NULL,
  deleted_at timestamptz,
  UNIQUE (installation_id, idempotency_key_hash)
);
CREATE TABLE analysis_jobs (
  id text PRIMARY KEY,
  analysis_id text NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','processing','retry_wait','completed','failed')),
  lease_until timestamptz,
  owner_token text,
  fence bigint NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  provider text,
  model_id text,
  prompt_version text,
  error_code text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (analysis_id, attempt)
);
CREATE INDEX analysis_jobs_claim_idx ON analysis_jobs (status, available_at, lease_until);
CREATE TABLE share_grants (
  public_id text PRIMARY KEY,
  analysis_id text NOT NULL UNIQUE REFERENCES analyses(id) ON DELETE CASCADE,
  secret_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  max_views integer NOT NULL DEFAULT 100,
  view_count integer NOT NULL DEFAULT 0
);
CREATE TABLE provider_daily_budget (
  day date PRIMARY KEY,
  spent integer NOT NULL CHECK (spent >= 0)
);
CREATE TABLE share_sessions (
  session_hash text PRIMARY KEY,
  public_id text NOT NULL REFERENCES share_grants(public_id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
COMMIT;
