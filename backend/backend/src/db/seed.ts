import bcrypt from "bcryptjs";
import path from "node:path";
import { pool } from "./pool.js";
import { seedMatters } from "./seed-matters.js";

const DEMO_PASSWORD = "11223344";

const DEMO_ACCOUNTS = [
  {
    email: "solicitor@gmail.com",
    firstName: "Rachel",
    lastName: "Okonkwo",
    phone: "+44 7700 900200",
    role: "solicitor",
    title: "Lead Insolvency Solicitor",
    avatar: "RO",
    reference: null,
    sraNumber: "SRA-629104",
  },
  {
    email: "amelia.hartley@example.co.uk",
    firstName: "Amelia",
    lastName: "Hartley",
    phone: "+44 7700 900312",
    role: "client",
    title: "Client / Debt Applicant",
    avatar: "AH",
    reference: "AQ-2026-04417",
    sraNumber: null,
  },
] as const;

export async function seed() {
  // Demo accounts have a published password, so a production server only creates them when told to.
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_ACCOUNTS !== "true") {
    console.log("Production: demo accounts are not created (set SEED_DEMO_ACCOUNTS=true to allow them).");
    return;
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const user of DEMO_ACCOUNTS) {
    await pool.query(
      `INSERT INTO users (
         email, password_hash, first_name, last_name, phone, role, title, avatar, reference, sra_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         phone = EXCLUDED.phone,
         role = EXCLUDED.role,
         title = EXCLUDED.title,
         avatar = EXCLUDED.avatar,
         reference = COALESCE(users.reference, EXCLUDED.reference),
         sra_number = EXCLUDED.sra_number,
         updated_at = NOW()`,
      [
        user.email,
        passwordHash,
        user.firstName,
        user.lastName,
        user.phone,
        user.role,
        user.title,
        user.avatar,
        user.reference,
        user.sraNumber,
      ],
    );
  }

  // The demo solicitor is the firm's Principal in the compliance system (only set once, so later changes stick).
  await pool.query(
    `UPDATE users SET compliance_role = 'principal'
     WHERE email = $1
       AND NOT EXISTS (SELECT 1 FROM users WHERE compliance_role = 'principal')`,
    [DEMO_ACCOUNTS[0].email],
  );

  console.log("Solicitor and customer demo accounts are ready.");

  if (process.env.SEED_MATTERS === "true") {
    await seedMatters();
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]).includes("seed.ts");

if (isDirectRun) {
  seed()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
