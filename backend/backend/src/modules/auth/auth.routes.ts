import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middleware/authenticate.js";
import { authController } from "./auth.controller.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please wait and try again." },
});

export const authRouter = Router();

authRouter.post("/register", authLimiter, authController.register);
authRouter.post("/login", authLimiter, authController.login);
authRouter.post("/mfa/verify", authLimiter, authController.verifyMfa);
authRouter.post("/mfa/login-setup", authLimiter, authController.setupMfaAtLogin);
authRouter.post("/mfa/setup", authenticate, authController.setupMfa);
authRouter.post("/mfa/enable", authLimiter, authenticate, authController.enableMfa);
authRouter.post("/mfa/disable", authLimiter, authenticate, authController.disableMfa);
authRouter.post("/change-password", authLimiter, authenticate, authController.changePassword);
authRouter.post("/logout", authController.logout);
authRouter.get("/me", authenticate, authController.me);
authRouter.post("/forgot-password", authLimiter, authController.forgotPassword);
authRouter.post("/reset-password", authLimiter, authController.resetPassword);
