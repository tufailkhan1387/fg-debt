import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./appError.js";
import type { AuthTokenPayload } from "../modules/auth/auth.types.js";

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    next(new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED"));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
    if (payload.purpose === "mfa") {
      // Half-finished sign-in (password ok, MFA code pending) must not grant access.
      throw new Error("MFA pending");
    }
    req.auth = payload;
    next();
  } catch {
    next(new AppError("Your session has expired. Please sign in again.", 401, "INVALID_TOKEN"));
  }
}
