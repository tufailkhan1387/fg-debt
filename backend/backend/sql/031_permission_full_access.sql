-- "Full access" level: everything the Principal can do in that area (approve, sign off, delete, restore).
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'compliance_permissions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%access_level%'
  LOOP
    EXECUTE format('ALTER TABLE compliance_permissions DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE compliance_permissions
    ADD CONSTRAINT compliance_permissions_access_level_check CHECK (access_level IN ('none', 'view', 'edit', 'full'));
END
$$;
