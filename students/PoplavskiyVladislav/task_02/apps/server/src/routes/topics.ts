import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { HttpError, ok } from "../lib/http";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGroupMember, requireGroupOwner } from "../middlewares/requireGroupMember";

export const topicsRouter = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
});

const createTopicSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  order: z.number().int().min(0).max(100000).optional(),
});

topicsRouter.get(
  "/groups/:groupId/topics",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const { limit, offset } = listQuerySchema.parse(req.query);

      const topics = await prisma.topic.findMany({
        where: { groupId },
        select: { id: true, title: true, description: true, order: true, isDone: true, doneAt: true },
        orderBy: [{ order: "asc" }, { title: "asc" }],
        take: limit ?? 50,
        skip: offset ?? 0,
      });

      res.status(200).json(ok(topics));
    } catch (e) {
      next(e);
    }
  }
);

topicsRouter.post(
  "/groups/:groupId/topics",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const { title, description, order } = createTopicSchema.parse(req.body);

      const created = await prisma.topic.create({
        data: { groupId, title, description, order },
        select: { id: true, title: true, description: true, order: true, isDone: true, doneAt: true },
      });

      res.status(201).json(ok(created));
    } catch (e) {
      next(e);
    }
  }
);

const updateTopicSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(5000).nullable().optional(),
    order: z.number().int().min(0).max(100000).nullable().optional(),
    isDone: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

topicsRouter.patch(
  "/groups/:groupId/topics/:topicId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const topicId = req.params.topicId;
      const patch = updateTopicSchema.parse(req.body);

      const result = await prisma.topic.updateMany({
        where: { id: topicId, groupId },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.order !== undefined ? { order: patch.order } : {}),
          ...(patch.isDone !== undefined
            ? {
                isDone: patch.isDone,
                doneAt: patch.isDone ? new Date() : null,
              }
            : {}),
        },
      });

      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Topic not found");
      }

      const updated = await prisma.topic.findFirst({
        where: { id: topicId, groupId },
        select: { id: true, title: true, description: true, order: true, isDone: true, doneAt: true },
      });

      res.status(200).json(ok(updated));
    } catch (e) {
      next(e);
    }
  }
);

topicsRouter.delete(
  "/groups/:groupId/topics/:topicId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const topicId = req.params.topicId;

      const result = await prisma.topic.deleteMany({ where: { id: topicId, groupId } });
      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Topic not found");
      }

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);
