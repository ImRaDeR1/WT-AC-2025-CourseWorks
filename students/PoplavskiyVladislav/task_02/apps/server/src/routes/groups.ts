import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { HttpError, ok } from "../lib/http";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGroupMember, requireGroupOwner } from "../middlewares/requireGroupMember";

export const groupsRouter = Router();

const createGroupSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  isPublic: z.boolean().optional(),
});

groupsRouter.get("/groups", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      select: {
        role: true,
        group: {
          select: { id: true, title: true, description: true, isPublic: true, ownerId: true, createdAt: true },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    res.status(200).json(
      ok(
        memberships.map((m) => ({
          ...m.group,
          myRole: m.role,
        }))
      )
    );
  } catch (e) {
    next(e);
  }
});

groupsRouter.post("/groups", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const { title, description, isPublic } = createGroupSchema.parse(req.body);

    const created = await prisma.$transaction(async (tx) => {
      const group = await tx.studyGroup.create({
        data: { title, description, isPublic: isPublic ?? true, ownerId: userId },
        select: { id: true, title: true, description: true, isPublic: true, ownerId: true, createdAt: true },
      });

      await tx.membership.create({
        data: { groupId: group.id, userId, role: "owner" },
        select: { id: true },
      });

      return group;
    });

    res.status(201).json(ok({ ...created, myRole: "owner" as const }));
  } catch (e) {
    next(e);
  }
});

groupsRouter.get("/groups/:groupId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;

    const group = await prisma.studyGroup.findUnique({
      where: { id: groupId },
      select: { id: true, title: true, description: true, isPublic: true, ownerId: true, createdAt: true },
    });

    if (!group) {
      throw new HttpError(404, "not_found", "Group not found");
    }

    const membership = await prisma.membership.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: { role: true },
    });

    if (!group.isPublic && !membership) {
      throw new HttpError(403, "forbidden", "Not allowed");
    }

    res.status(200).json(ok({ ...group, myRole: membership?.role ?? null }));
  } catch (e) {
    next(e);
  }
});

groupsRouter.get(
  "/groups/:groupId/members",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;

      const members = await prisma.membership.findMany({
        where: { groupId },
        select: {
          role: true,
          joinedAt: true,
          user: { select: { id: true, username: true } },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      });

      res
        .status(200)
        .json(ok(members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt }))));
    } catch (e) {
      next(e);
    }
  }
);

const updateGroupSchema = z
  .object({
    title: z.string().min(3).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
    isPublic: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

groupsRouter.patch(
  "/groups/:groupId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const patch = updateGroupSchema.parse(req.body);

      const updated = await prisma.studyGroup.update({
        where: { id: groupId },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.isPublic !== undefined ? { isPublic: patch.isPublic } : {}),
        },
        select: { id: true, title: true, description: true, isPublic: true, ownerId: true, createdAt: true },
      });

      res.status(200).json(ok(updated));
    } catch (e) {
      next(e);
    }
  }
);

groupsRouter.delete(
  "/groups/:groupId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;

      await prisma.studyGroup.delete({ where: { id: groupId } });

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);

groupsRouter.post("/groups/:groupId/join", requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const groupId = req.params.groupId;

    const group = await prisma.studyGroup.findUnique({
      where: { id: groupId },
      select: { id: true, isPublic: true },
    });

    if (!group) {
      throw new HttpError(404, "not_found", "Group not found");
    }

    if (!group.isPublic) {
      throw new HttpError(403, "forbidden", "Group is private");
    }

    const membership = await prisma.membership.upsert({
      where: { groupId_userId: { groupId, userId } },
      update: {},
      create: { groupId, userId, role: "member" },
      select: { id: true, role: true },
    });

    res.status(200).json(ok({ joined: true, role: membership.role }));
  } catch (e) {
    next(e);
  }
});

groupsRouter.post(
  "/groups/:groupId/leave",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const userId = req.auth!.userId;
      const groupId = req.params.groupId;

      if (req.groupAccess?.membershipRole === "owner") {
        throw new HttpError(400, "bad_request", "Owner cannot leave the group");
      }

      await prisma.membership.delete({ where: { groupId_userId: { groupId, userId } } });

      res.status(200).json(ok({ left: true }));
    } catch (e) {
      next(e);
    }
  }
);
