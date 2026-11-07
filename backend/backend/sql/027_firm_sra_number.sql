-- The firm's SRA number is 817529; replace the old placeholder on existing accounts.
UPDATE users SET sra_number = 'SRA-817529', updated_at = NOW() WHERE sra_number = 'SRA-629104';
