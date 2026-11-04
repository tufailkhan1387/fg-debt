import { AppError } from "../../middleware/appError.js";
import { authService } from "../auth/auth.service.js";
import { mattersService } from "../matters/matters.service.js";
import { buildClientVerification } from "./verification.helpers.js";
import type { ClientVerificationResult } from "./verification.types.js";

export const verificationService = {
  async getForClient(userId: string, email: string): Promise<ClientVerificationResult> {
    const user = await authService.me(userId);
    const matter = await mattersService.getForClient(userId, email);
    return buildClientVerification(matter, { email: user.email, phone: user.phone });
  },

  async completeLiveness(userId: string, email: string, clientName: string): Promise<ClientVerificationResult> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("Submit your assessment before completing identity checks.", 404, "MATTER_NOT_FOUND");
    }

    const idDocs = (matter.documents as Array<{ category: string }>).filter((doc) => doc.category === "id_proof");
    if (idDocs.length === 0) {
      throw new AppError("Upload photo ID before starting the liveness check.", 400, "PHOTO_ID_REQUIRED");
    }

    if (matter.identityVerification?.livenessStatus === "passed") {
      const user = await authService.me(userId);
      return buildClientVerification(matter, { email: user.email, phone: user.phone });
    }

    const updated = await mattersService.recordClientIdentityLiveness(matter.id, clientName);
    const user = await authService.me(userId);
    return buildClientVerification(updated, { email: user.email, phone: user.phone });
  },
};
