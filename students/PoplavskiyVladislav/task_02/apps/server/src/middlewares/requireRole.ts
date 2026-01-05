import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";

import { HttpError } from "../lib/http";

export const requireRole = (role: UserRole) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new HttpError(401, "unauthorized", "Unauthorized"));
      return;
    }

    if (req.auth.role !== role) {
      next(new HttpError(403, "forbidden", "Forbidden"));
      return;
    }

    next();
  };
};
