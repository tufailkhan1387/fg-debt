import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "../../middleware/appError.js";
import { changeClientPasswordSchema } from "../profile/profile.validators.js";
import { authService } from "./auth.service.js";
import {
  forgotPasswordSchema,
  loginSchema,
  mfaCodeSchema,
  mfaVerifySchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.validators.js";

function parseBody<T>(schema: ZodSchema<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  }
  return result.data;
}

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = parseBody(registerSchema, req.body);
      const data = await authService.register(input);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = parseBody(loginSchema, req.body);
      const data = await authService.login(input, req.ip);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async verifyMfa(req: Request, res: Response, next: NextFunction) {
    try {
      const input = parseBody(mfaVerifySchema, req.body);
      const data = await authService.verifyMfaLogin(input, req.ip);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async setupMfa(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const data = await authService.setupMfa(req.auth.sub);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async enableMfa(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const { code } = parseBody(mfaCodeSchema, req.body);
      const user = await authService.enableMfa(req.auth.sub, code, req.ip);
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },

  async disableMfa(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const { code } = parseBody(mfaCodeSchema, req.body);
      const user = await authService.disableMfa(req.auth.sub, code, req.ip);
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const input = parseBody(changeClientPasswordSchema, req.body);
      await authService.changePassword(req.auth.sub, input, req.ip);
      res.json({ success: true, data: { message: "Password updated." } });
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const user = await authService.me(req.auth.sub);
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },

  async logout(_req: Request, res: Response) {
    res.json({ success: true, data: { message: "Signed out." } });
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = parseBody(forgotPasswordSchema, req.body);
      const data = await authService.forgotPassword(input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const input = parseBody(resetPasswordSchema, req.body);
      await authService.resetPassword(input);
      res.json({
        success: true,
        data: { message: "Password updated. You can now sign in with your new password." },
      });
    } catch (error) {
      next(error);
    }
  },
};
