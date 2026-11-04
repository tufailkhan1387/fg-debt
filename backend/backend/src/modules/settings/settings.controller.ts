import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../middleware/appError.js";

import { settingsService } from "./settings.service.js";

import {

  createFirmRuleSchema,

  createDocumentTemplateSchema,

  createReferralPartnerSchema,

  settingsRuleCategoryParamSchema,

  updateFirmIntegrationSchema,

  updateFirmProfileSchema,

  updateFirmRuleSchema,

  updateDocumentTemplateSchema,

  updateReferralPartnerSchema,

  updateReminderSettingSchema,

  updateSlaRuleSchema,

  updateWorkflowSettingSchema,

} from "./settings.validators.js";



function slugParam(value: string | string[]): string {

  return Array.isArray(value) ? value[0] : value;

}



function actorName(req: Request): string {

  return req.auth?.email ?? "Solicitor";

}



export const settingsController = {

  async getBundle(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }

      const settings = await settingsService.getBundle(req.auth.email);

      res.json({ success: true, data: { settings } });

    } catch (error) {

      next(error);

    }

  },



  async updateFirmProfile(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = updateFirmProfileSchema.parse(req.body);

      const firm = await settingsService.updateFirmProfile(input, actorName(req));

      res.json({ success: true, data: { firm } });

    } catch (error) {

      next(error);

    }

  },



  async getPartners(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }

      const partners = await settingsService.getPartners(req.auth.email);

      res.json({ success: true, data: { partners } });

    } catch (error) {

      next(error);

    }

  },



  async getIntegrations(_req: Request, res: Response, next: NextFunction) {

    try {

      const integrations = await settingsService.getIntegrations();

      res.json({ success: true, data: { integrations } });

    } catch (error) {

      next(error);

    }

  },



  async getIntegration(req: Request, res: Response, next: NextFunction) {

    try {

      const integration = await settingsService.getIntegration(slugParam(req.params.slug));

      res.json({ success: true, data: { integration } });

    } catch (error) {

      next(error);

    }

  },



  async getRules(req: Request, res: Response, next: NextFunction) {

    try {

      const category = settingsRuleCategoryParamSchema.parse(slugParam(req.params.category));

      const rules = await settingsService.getRules(category);

      res.json({ success: true, data: { rules } });

    } catch (error) {

      next(error);

    }

  },



  async createRule(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const category = settingsRuleCategoryParamSchema.parse(slugParam(req.params.category));

      const input = createFirmRuleSchema.parse(req.body);

      const rule = await settingsService.createRule(category, input, actorName(req));

      res.status(201).json({ success: true, data: { rule } });

    } catch (error) {

      next(error);

    }

  },



  async updateRule(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const category = settingsRuleCategoryParamSchema.parse(slugParam(req.params.category));

      const input = updateFirmRuleSchema.parse(req.body);

      const rule = await settingsService.updateRule(category, slugParam(req.params.ruleId), input, actorName(req));

      res.json({ success: true, data: { rule } });

    } catch (error) {

      next(error);

    }

  },



  async updateIntegration(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = updateFirmIntegrationSchema.parse(req.body);

      const integration = await settingsService.updateIntegration(slugParam(req.params.slug), input, actorName(req));

      res.json({ success: true, data: { integration } });

    } catch (error) {

      next(error);

    }

  },



  async syncIntegration(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const integration = await settingsService.syncIntegration(slugParam(req.params.slug), actorName(req));

      res.json({ success: true, data: { integration } });

    } catch (error) {

      next(error);

    }

  },



  async getReminders(_req: Request, res: Response, next: NextFunction) {

    try {

      const reminders = await settingsService.getReminders();

      res.json({ success: true, data: { reminders } });

    } catch (error) {

      next(error);

    }

  },



  async getWorkflows(_req: Request, res: Response, next: NextFunction) {

    try {

      const workflows = await settingsService.getWorkflows();

      res.json({ success: true, data: { workflows } });

    } catch (error) {

      next(error);

    }

  },



  async getSlaRules(_req: Request, res: Response, next: NextFunction) {

    try {

      const slaRules = await settingsService.getSlaRules();

      res.json({ success: true, data: { slaRules } });

    } catch (error) {

      next(error);

    }

  },



  async updateWorkflow(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = updateWorkflowSettingSchema.parse(req.body);

      const workflow = await settingsService.updateWorkflow(slugParam(req.params.id), input, actorName(req));

      res.json({ success: true, data: { workflow } });

    } catch (error) {

      next(error);

    }

  },



  async updateReminder(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = updateReminderSettingSchema.parse(req.body);

      const reminder = await settingsService.updateReminder(slugParam(req.params.id), input, actorName(req));

      res.json({ success: true, data: { reminder } });

    } catch (error) {

      next(error);

    }

  },



  async getDocumentTemplates(_req: Request, res: Response, next: NextFunction) {

    try {

      const documentTemplates = await settingsService.getDocumentTemplates();

      res.json({ success: true, data: { documentTemplates } });

    } catch (error) {

      next(error);

    }

  },



  async createDocumentTemplate(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = createDocumentTemplateSchema.parse(req.body);

      const template = await settingsService.createDocumentTemplate(input, actorName(req));

      res.status(201).json({ success: true, data: { template } });

    } catch (error) {

      next(error);

    }

  },



  async updateDocumentTemplate(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = updateDocumentTemplateSchema.parse(req.body);

      const template = await settingsService.updateDocumentTemplate(slugParam(req.params.id), input, actorName(req));

      res.json({ success: true, data: { template } });

    } catch (error) {

      next(error);

    }

  },



  async createReferralPartner(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = createReferralPartnerSchema.parse(req.body);

      const partner = await settingsService.createReferralPartner(input, actorName(req));

      res.status(201).json({ success: true, data: { partner } });

    } catch (error) {

      next(error);

    }

  },



  async updateReferralPartner(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = updateReferralPartnerSchema.parse(req.body);

      const partner = await settingsService.updateReferralPartner(

        slugParam(req.params.id),

        input,

        req.auth.email,

        actorName(req),

      );

      res.json({ success: true, data: { partner } });

    } catch (error) {

      next(error);

    }

  },



  async updateSlaRule(req: Request, res: Response, next: NextFunction) {

    try {

      if (!req.auth?.email) {

        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");

      }



      const input = updateSlaRuleSchema.parse(req.body);

      const slaRule = await settingsService.updateSlaRule(slugParam(req.params.id), input, actorName(req));

      res.json({ success: true, data: { slaRule } });

    } catch (error) {

      next(error);

    }

  },

};
