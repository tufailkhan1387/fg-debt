import type { NextFunction, Request, Response } from "express";

import { z } from "zod";

import { AppError } from "../../middleware/appError.js";

import { authService } from "../auth/auth.service.js";

import { mattersService } from "./matters.service.js";

import { createMatterSchema } from "./matters.validators.js";
import { sendMessageSchema } from "../messages/messages.validators.js";
import { messagesService } from "../messages/messages.service.js";
import { documentsService } from "../documents/documents.service.js";
import { verifyDocumentSchema } from "../documents/documents.validators.js";
import { createTaskSchema, resolveTaskSchema } from "../tasks/tasks.validators.js";
import { tasksService } from "../tasks/tasks.service.js";
import { createReferralSchema, updateReferralStatusSchema } from "../referrals/referrals.validators.js";
import { referralsService } from "../referrals/referrals.service.js";
import { createNoteSchema } from "../notes/notes.validators.js";
import { notesService } from "../notes/notes.service.js";
import { adviceService } from "../advice/advice.service.js";
import { closeMatterSchema } from "../closure/closure.validators.js";

function matterIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function documentIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function taskIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function referralIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function generatedDocumentIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const decisionSchema = z.object({

  action: z.enum(["approve", "amend", "reject", "override"]),

  notes: z.string().min(1, "Decision notes are required."),

  amendedSolution: z.string().optional(),

  solicitorName: z.string().min(1, "Solicitor name is required."),

});



export const mattersController = {

  async list(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }

      const matters = await mattersService.listForSolicitor(req.auth.email);

      res.json({ success: true, data: { matters } });

    } catch (error) {

      next(error);

    }

  },



  async listFull(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }

      const matters = await mattersService.listFullForSolicitor(req.auth.email);

      res.json({ success: true, data: { matters } });

    } catch (error) {

      next(error);

    }

  },



  async create(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.sub || !req.auth.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }

      const parsed = createMatterSchema.safeParse(req.body);

      if (!parsed.success) {

        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid matter payload.", 400, "VALIDATION_ERROR");

      }

      const solicitor = await authService.me(req.auth.sub);

      const matter = await mattersService.createForSolicitor(

        {

          solicitorUserId: req.auth.sub,

          solicitorEmail: req.auth.email,

          solicitorName: solicitor.name,

        },

        parsed.data,

      );

      res.status(201).json({ success: true, data: { matter } });

    } catch (error) {

      next(error);

    }

  },



  async getById(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }

      const matter = await mattersService.getByIdForSolicitor(req.auth.email, matterIdParam(req.params.id));

      res.json({ success: true, data: { matter } });

    } catch (error) {

      next(error);

    }

  },



  async recordDecision(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }

      const parsed = decisionSchema.safeParse(req.body);

      if (!parsed.success) {

        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid decision payload.", 400, "VALIDATION_ERROR");

      }

      const matter = await mattersService.recordDecision(req.auth.email, matterIdParam(req.params.id), parsed.data);

      res.json({ success: true, data: { matter } });

    } catch (error) {

      next(error);

    }

  },

  async listMessages(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const thread = await messagesService.getSolicitorThread(
        req.auth.email,
        matterIdParam(req.params.id),
      );
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
      const parsed = sendMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid message payload.", 400, "VALIDATION_ERROR");
      }
      const solicitor = await authService.me(req.auth.sub);
      const message = await messagesService.sendSolicitorMessage(
        req.auth.email,
        matterIdParam(req.params.id),
        solicitor.name,
        parsed.data.content,
      );
      res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      next(error);
    }
  },

  async markMessagesRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      await messagesService.markSolicitorThreadRead(req.auth.email, matterIdParam(req.params.id));
      res.json({ success: true, data: { read: true } });
    } catch (error) {
      next(error);
    }
  },

  async verifyDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = verifyDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid verification payload.", 400, "VALIDATION_ERROR");
      }
      const solicitor = await authService.me(req.auth.sub);
      const matter = await mattersService.verifyDocument(
        req.auth.email,
        matterIdParam(req.params.id),
        documentIdParam(req.params.documentId),
        parsed.data.status,
        solicitor.name,
        parsed.data.notes,
      );
      res.json({ success: true, data: { matter } });
    } catch (error) {
      next(error);
    }
  },

  async downloadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const file = await documentsService.getDownloadForSolicitor(
        req.auth.email,
        matterIdParam(req.params.id),
        documentIdParam(req.params.documentId),
      );
      res.download(file.absolutePath, file.fileName, (error) => {
        if (error) next(error);
      });
    } catch (error) {
      next(error);
    }
  },

  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid task payload.", 400, "VALIDATION_ERROR");
      }
      const result = await tasksService.createSolicitorTask(
        req.auth.email,
        matterIdParam(req.params.id),
        parsed.data.solicitorName,
        parsed.data,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async resolveTask(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = resolveTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid task payload.", 400, "VALIDATION_ERROR");
      }
      const result = await tasksService.resolveSolicitorTask(
        req.auth.email,
        matterIdParam(req.params.id),
        taskIdParam(req.params.taskId),
        parsed.data.solicitorName,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async createReferral(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = createReferralSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid referral payload.", 400, "VALIDATION_ERROR");
      }
      const result = await referralsService.createForMatter(
        req.auth.email,
        matterIdParam(req.params.id),
        parsed.data.solicitorName,
        parsed.data,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async updateReferralStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = updateReferralStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid referral payload.", 400, "VALIDATION_ERROR");
      }
      const result = await referralsService.updateStatus(
        req.auth.email,
        matterIdParam(req.params.id),
        referralIdParam(req.params.referralId),
        parsed.data.solicitorName,
        parsed.data.status,
        parsed.data.notes,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async listNotes(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const thread = await notesService.listForMatter(req.auth.email, matterIdParam(req.params.id));
      res.json({ success: true, data: { thread } });
    } catch (error) {
      next(error);
    }
  },

  async createNote(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = createNoteSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid note payload.", 400, "VALIDATION_ERROR");
      }
      const result = await notesService.addForMatter(
        req.auth.email,
        matterIdParam(req.params.id),
        parsed.data.solicitorName,
        parsed.data.content,
        parsed.data.isInternal ?? true,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async downloadGeneratedDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const file = await adviceService.downloadForSolicitor(
        req.auth.email,
        matterIdParam(req.params.id),
        generatedDocumentIdParam(req.params.documentId),
      );
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
      res.send(file.content);
    } catch (error) {
      next(error);
    }
  },

  async previewGeneratedDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const preview = await adviceService.previewForSolicitor(
        req.auth.email,
        matterIdParam(req.params.id),
        generatedDocumentIdParam(req.params.documentId),
      );
      res.json({ success: true, data: preview });
    } catch (error) {
      next(error);
    }
  },

  async closeMatter(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = closeMatterSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid closure payload.", 400, "VALIDATION_ERROR");
      }
      const matter = await mattersService.closeMatter(
        req.auth.email,
        matterIdParam(req.params.id),
        parsed.data,
      );
      res.json({ success: true, data: { matter } });
    } catch (error) {
      next(error);
    }
  },

};

