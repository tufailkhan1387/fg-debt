-- Procedures used to share the Policy Library right; they now have their own "procedures" right. Once only, each
-- user keeps the access they had: their Policy Library level is copied to the Procedure Library. Migrations run on
-- every start, so an access log entry marks the copy as done (later changes in Users & Access are never undone).
DO $copy$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM compliance_audit_log WHERE action = 'system.procedure_rights_copied') THEN
    INSERT INTO compliance_permissions (user_id, module, access_level)
    SELECT user_id, 'procedures', access_level FROM compliance_permissions WHERE module = 'policies'
    ON CONFLICT (user_id, module) DO NOTHING;

    INSERT INTO compliance_audit_log (user_email, action, entity_type, details)
    VALUES ('system', 'system.procedure_rights_copied', 'access',
            jsonb_build_object('users', (SELECT COUNT(*) FROM compliance_permissions WHERE module = 'procedures')));
  END IF;
END
$copy$;
