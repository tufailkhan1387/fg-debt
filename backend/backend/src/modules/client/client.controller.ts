import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { authService } from "../auth/auth.service.js";
import { clientService } from "./client.service.js";
import { sendMessageSchema } from "../messages/messages.validators.js";
import { completeTaskSchema } from "../tasks/tasks.validators.js";
import { tasksService } from "../tasks/tasks.service.js";
import { referralsService } from "../referrals/referrals.service.js";
import { adviceService } from "../advice/advice.service.js";
import { riskService } from "../risk/risk.service.js";
import { analysisService } from "../analysis/analysis.service.js";
import { verificationService } from "../verification/verification.service.js";
import { clientAdviserService } from "../client-adviser/client-adviser.service.js";
import { clientDebtOptionsService } from "../client-debt-options/debt-options.service.js";
import { assistantService } from "../assistant/assistant.service.js";
import { assistantChatSchema } from "../assistant/assistant.validators.js";
import { documentsService } from "../documents/documents.service.js";
import { submitAssessmentSchema, uploadDocumentSchema } from "./client.validators.js";
import { profileService } from "../profile/profile.service.js";
import { updateClientProfileSchema, changeClientPasswordSchema, clientNotificationPrefsSchema, requestAccountClosureSchema } from "../profile/profile.validators.js";

function documentIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function taskIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function referralIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function riskViewParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const clientController = {
  async portal(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const portal = await clientService.getPortal(req.auth.sub);
      res.json({ success: true, data: { portal } });
    } catch (error) {
      next(error);
    }
  },

  async submitAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const input = submitAssessmentSchema.parse(req.body);
      const result = await clientService.submitAssessment(req.auth.sub, req.auth.email, input);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      if (!req.file) {
        throw new AppError("A file is required.", 400, "FILE_REQUIRED");
      }

      const { category } = uploadDocumentSchema.parse(req.body);
      const document = await clientService.uploadDocument(
        req.auth.sub,
        req.auth.email,
        category,
        req.file,
      );

      res.status(201).json({
        success: true,
        data: {
          document: {
            id: document.id,
            name: document.name,
            category: document.category,
            size: document.size,
            date: document.uploadedAt,
            status: "Pending",
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async downloadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const file = await clientService.getDocumentDownload(
        req.auth.sub,
        req.auth.email,
        documentIdParam(req.params.documentId),
      );

      res.download(file.absolutePath, file.fileName, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  },

  async messages(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const thread = await clientService.getMessages(req.auth.sub, req.auth.email);
      res.json({ success: true, data: { thread } });
    } catch (error) {
      next(error);
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const input = sendMessageSchema.parse(req.body);
      const user = await authService.me(req.auth.sub);
      const message = await clientService.sendMessage(
        req.auth.sub,
        req.auth.email,
        user.name,
        input,
      );
      res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      next(error);
    }
  },

  async markMessagesRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      await clientService.markMessagesRead(req.auth.sub, req.auth.email);
      res.json({ success: true, data: { read: true } });
    } catch (error) {
      next(error);
    }
  },

  async tasks(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const tasks = await clientService.getTasks(req.auth.sub, req.auth.email);
      res.json({ success: true, data: { tasks } });
    } catch (error) {
      next(error);
    }
  },

  async completeTask(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const input = completeTaskSchema.parse(req.body);
      const result = await clientService.completeTask(req.auth.sub, req.auth.email, taskIdParam(req.params.taskId), input.response);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async acknowledgeReferral(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const referral = await referralsService.acknowledgeForClient(
        req.auth.sub,
        req.auth.email,
        referralIdParam(req.params.referralId),
      );
      res.json({ success: true, data: { referral } });
    } catch (error) {
      next(error);
    }
  },

  async downloadGeneratedDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const file = await clientService.downloadGeneratedDocument(
        req.auth.sub,
        req.auth.email,
        documentIdParam(req.params.documentId),
      );
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
      res.send(file.content);
    } catch (error) {
      next(error);
    }
  },

  async riskView(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await riskService.getViewForClient(
        req.auth.sub,
        req.auth.email,
        riskViewParam(req.params.view),
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async vulnerabilityView(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await analysisService.getVulnerabilityForClient(
        req.auth.sub,
        req.auth.email,
        riskViewParam(req.params.view),
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async verification(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const verification = await verificationService.getForClient(req.auth.sub, req.auth.email);
      res.json({ success: true, data: verification });
    } catch (error) {
      next(error);
    }
  },

  async completeLiveness(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const user = await authService.me(req.auth.sub);
      const verification = await verificationService.completeLiveness(
        req.auth.sub,
        req.auth.email,
        user.name,
      );
      res.json({ success: true, data: verification });
    } catch (error) {
      next(error);
    }
  },

  async adviserSection(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const section = riskViewParam(req.params.section);
      const result = await clientAdviserService.getSection(req.auth.sub, req.auth.email, section);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async debtOptions(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await clientDebtOptionsService.getDebtOptions(req.auth.sub, req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async affordability(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await clientDebtOptionsService.getAffordability(req.auth.sub, req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async assistantBootstrap(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await assistantService.getBootstrap(req.auth.sub, req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async assistantChat(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const input = assistantChatSchema.parse(req.body);
      const result = await assistantService.chat(req.auth.sub, req.auth.email, input.message);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async documentHelp(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await documentsService.getHelpForClient(req.auth.sub, req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async debtAnalysisSection(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await analysisService.getDebtAnalysisForClient(
        req.auth.sub,
        req.auth.email,
        riskViewParam(req.params.section),
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async financialSection(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await analysisService.getFinancialSectionForClient(
        req.auth.sub,
        req.auth.email,
        riskViewParam(req.params.section),
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async financialSummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await analysisService.getFinancialSummaryForClient(req.auth.sub, req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async financialSummaryExport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const { csv, filename } = await analysisService.exportFinancialSummaryForClient(
        req.auth.sub,
        req.auth.email,
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },

  async debtSummaryExport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const { csv, filename } = await analysisService.exportDebtScheduleForClient(
        req.auth.sub,
        req.auth.email,
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const input = updateClientProfileSchema.parse(req.body);
      const customer = await profileService.updateForClient(req.auth.sub, input);
      res.json({ success: true, data: { customer } });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const input = changeClientPasswordSchema.parse(req.body);
      const result = await profileService.changePasswordForClient(req.auth.sub, input);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async notificationPrefs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const prefs = await profileService.getNotificationPrefsForClient(req.auth.sub);
      res.json({ success: true, data: { prefs } });
    } catch (error) {
      next(error);
    }
  },

  async updateNotificationPrefs(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const input = clientNotificationPrefsSchema.parse(req.body);
      const prefs = await profileService.updateNotificationPrefsForClient(req.auth.sub, input);
      res.json({ success: true, data: { prefs } });
    } catch (error) {
      next(error);
    }
  },

  async privacyRequests(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const requests = await profileService.getPrivacyRequestsForClient(req.auth.sub);
      res.json({ success: true, data: { requests } });
    } catch (error) {
      next(error);
    }
  },

  async requestDataExport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await profileService.requestDataExportForClient(req.auth.sub);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async requestAccountClosure(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const input = requestAccountClosureSchema.parse(req.body ?? {});
      const result = await profileService.requestAccountClosureForClient(req.auth.sub, input);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async debtSolutionSection(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await analysisService.getDebtSolutionForClient(
        req.auth.sub,
        req.auth.email,
        riskViewParam(req.params.section),
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async documentGeneratorSection(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await documentsService.getGeneratedForClient(
        req.auth.sub,
        req.auth.email,
        riskViewParam(req.params.section),
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
