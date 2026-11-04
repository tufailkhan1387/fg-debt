import type { AuthTokenPayload } from "../modules/auth/auth.types.js";
import type { ComplianceAccess } from "../modules/compliance-access/access.types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
      /** Set by requireCompliance. */
      compliance?: ComplianceAccess;
    }
  }
}

export {};
