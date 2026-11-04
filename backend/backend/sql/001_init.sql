-- pgcrypto is optional. Many hosted Postgres installs (cPanel, custom prefixes)
-- do not ship contrib modules, so CREATE EXTENSION pgcrypto fails with 58P01.
-- gen_random_uuid() is built into PostgreSQL 13+. On older servers without
-- pgcrypto, we add a SQL fallback with the same name.
DO $ext$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION
  WHEN undefined_file THEN
    RAISE NOTICE 'pgcrypto is not installed; using a SQL UUID fallback if needed.';
  WHEN feature_not_supported THEN
    RAISE NOTICE 'pgcrypto is not allowed; using a SQL UUID fallback if needed.';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'no permission to create pgcrypto; using a SQL UUID fallback if needed.';
END
$ext$;

DO $fn$
BEGIN
  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION gen_random_uuid()
      RETURNS uuid
      LANGUAGE sql
      AS $body$
        SELECT md5(random()::text || clock_timestamp()::text)::uuid;
      $body$;
    $sql$;
  END IF;
END
$fn$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(40),
  role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'solicitor')),
  title VARCHAR(120) NOT NULL,
  avatar VARCHAR(8) NOT NULL,
  reference VARCHAR(40) UNIQUE,
  sra_number VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_hash_idx ON password_reset_tokens (token_hash);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens (user_id);
