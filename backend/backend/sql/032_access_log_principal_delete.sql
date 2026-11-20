-- The access log stays append-only: edits are always blocked. Deleting entries is allowed only inside the
-- Principal's "delete access log entries" action, which sets fg.access_log_delete for its own transaction
-- (and records the deletion as a new entry).
CREATE OR REPLACE FUNCTION compliance_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('fg.access_log_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'compliance_audit_log is append-only';
END
$fn$;
