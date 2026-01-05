import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import { getBearerToken, verifyAccessToken } from "../lib/auth";

export const requireAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = getBearerToken(req.header("authorization"));
  if (!token) {
    next(new HttpError(401, "unauthorized", "Missing bearer token"));
    return;
  }

  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true },
  });

  if (!user) {
    next(new HttpError(401, "unauthorized", "User not found"));
    return;
  }

  req.auth = { userId: user.id, role: user.role };
  next();
};
