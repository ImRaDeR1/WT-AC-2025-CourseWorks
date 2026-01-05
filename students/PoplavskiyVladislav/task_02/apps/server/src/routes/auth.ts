import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { HttpError, ok } from "../lib/http";
import { hashPassword, signAccessToken, verifyPassword } from "../lib/auth";

export const authRouter = Router();

const registerSchema = z
  .object({
    username: z.string().min(3).max(30).optional(),
    name: z.string().min(3).max(30).optional(),
    email: z.string().email(),
    password: z.string().min(6).max(200),
  })
  .refine((v) => Boolean(v.username ?? v.name), {
    message: "username is required",
    path: ["username"],
  })
  .transform((v) => ({
    username: (v.username ?? v.name)!,
    email: v.email,
    password: v.password,
  }));

authRouter.post("/auth/register", async (req, res, next) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);

    const passwordHash = await hashPassword(password);

    const created = await prisma.user.create({
      data: { username, email, passwordHash, role: "user" },
      select: { id: true, username: true, email: true, role: true },
    });

    const accessToken = signAccessToken({ sub: created.id, role: created.role });

    res.status(201).json(ok({ accessToken, user: created }));
  } catch (e: unknown) {
    // Prisma unique violation
    if (typeof e === "object" && e && (e as { code?: unknown }).code === "P2002") {
      next(new HttpError(409, "conflict", "User already exists"));
      return;
    }
    next(e);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

authRouter.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, username: true, email: true, role: true, passwordHash: true },
    });

    if (!user) {
      throw new HttpError(401, "unauthorized", "Invalid credentials");
    }

    const isOk = await verifyPassword(password, user.passwordHash);
    if (!isOk) {
      throw new HttpError(401, "unauthorized", "Invalid credentials");
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });

    res.status(200).json(
      ok({
        accessToken,
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
      })
    );
  } catch (e) {
    next(e);
  }
});
