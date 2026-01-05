import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";

export type GroupAccess = {
  groupId: string;
  membershipRole: "owner" | "member";
};

declare module "express-serve-static-core" {
  interface Request {
    groupAccess?: GroupAccess;
  }
}

export const requireGroupMember = () => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new HttpError(401, "unauthorized", "Unauthorized"));
      return;
    }

    const groupId = req.params.groupId;
    if (!groupId) {
      next(new HttpError(400, "bad_request", "Missing groupId"));
      return;
    }

    const membership = await prisma.membership.findUnique({
      where: { groupId_userId: { groupId, userId: req.auth.userId } },
      select: { role: true },
    });

    if (!membership) {
      next(new HttpError(403, "forbidden", "Not a group member"));
      return;
    }

    req.groupAccess = { groupId, membershipRole: membership.role };
    next();
  };
};

export const requireGroupOwner = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const run = requireGroupMember();
    await run(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }

      if (!req.groupAccess || req.groupAccess.membershipRole !== "owner") {
        next(new HttpError(403, "forbidden", "Owner role required"));
        return;
      }

      next();
    });
  };
};
