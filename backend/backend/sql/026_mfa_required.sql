-- A Principal can require two-factor sign-in for a firm user; they must set it up at their next sign-in.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE;
