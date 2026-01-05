import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { HttpError, ok } from "../lib/http";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGroupMember, requireGroupOwner } from "../middlewares/requireGroupMember";

export const tasksRouter = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
});

const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(20000).optional(),
  dueAt: z.string().datetime().optional(),
  topicId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
});

tasksRouter.get(
  "/groups/:groupId/tasks",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const { limit, offset } = listQuerySchema.parse(req.query);

      const tasks = await prisma.task.findMany({
        where: { groupId },
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          status: true,
          createdAt: true,
          topicId: true,
          createdById: true,
          assigneeId: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit ?? 50,
        skip: offset ?? 0,
      });

      res.status(200).json(ok(tasks));
    } catch (e) {
      next(e);
    }
  }
);

tasksRouter.post(
  "/groups/:groupId/tasks",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const createdById = req.auth!.userId;
      const data = createTaskSchema.parse(req.body);

      if (data.topicId) {
        const topic = await prisma.topic.findFirst({ where: { id: data.topicId, groupId }, select: { id: true } });
        if (!topic) {
          throw new HttpError(400, "bad_request", "topicId is not in this group");
        }
      }

      if (data.assigneeId) {
        const member = await prisma.membership.findFirst({
          where: { groupId, userId: data.assigneeId },
          select: { id: true },
        });
        if (!member) {
          throw new HttpError(400, "bad_request", "assigneeId is not a group member");
        }
      }

      const created = await prisma.task.create({
        data: {
          groupId,
          createdById,
          title: data.title,
          description: data.description,
          dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
          topicId: data.topicId,
          assigneeId: data.assigneeId,
        },
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          status: true,
          createdAt: true,
          topicId: true,
          createdById: true,
          assigneeId: true,
        },
      });

      res.status(201).json(ok(created));
    } catch (e) {
      next(e);
    }
  }
);

const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(20000).nullable().optional(),
    dueAt: z.string().datetime().nullable().optional(),
    status: taskStatusSchema.optional(),
    topicId: z.string().uuid().nullable().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

const memberStatusSchema = z.object({ status: taskStatusSchema });

tasksRouter.patch(
  "/groups/:groupId/tasks/:taskId",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const taskId = req.params.taskId;

      const membershipRole = req.groupAccess?.membershipRole;
      if (!membershipRole) {
        throw new HttpError(403, "forbidden", "Not a group member");
      }

      // Members can only change status of tasks assigned to them.
      if (membershipRole !== "owner") {
        const patch = memberStatusSchema.parse(req.body);

        const task = await prisma.task.findFirst({
          where: { id: taskId, groupId },
          select: { id: true, assigneeId: true },
        });

        if (!task) {
          throw new HttpError(404, "not_found", "Task not found");
        }

        if (!task.assigneeId || task.assigneeId !== req.auth!.userId) {
          throw new HttpError(403, "forbidden", "Only assignee can change status");
        }

        const updated = await prisma.task.update({
          where: { id: taskId },
          data: { status: patch.status },
          select: {
            id: true,
            title: true,
            description: true,
            dueAt: true,
            status: true,
            createdAt: true,
            topicId: true,
            createdById: true,
            assigneeId: true,
          },
        });

        res.status(200).json(ok(updated));
        return;
      }

      const patch = updateTaskSchema.parse(req.body);

      if (patch.topicId) {
        const topic = await prisma.topic.findFirst({ where: { id: patch.topicId, groupId }, select: { id: true } });
        if (!topic) {
          throw new HttpError(400, "bad_request", "topicId is not in this group");
        }
      }

      if (patch.assigneeId) {
        const member = await prisma.membership.findFirst({
          where: { groupId, userId: patch.assigneeId },
          select: { id: true },
        });
        if (!member) {
          throw new HttpError(400, "bad_request", "assigneeId is not a group member");
        }
      }

      const result = await prisma.task.updateMany({
        where: { id: taskId, groupId },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt ? new Date(patch.dueAt) : null } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.topicId !== undefined ? { topicId: patch.topicId } : {}),
          ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
        },
      });

      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Task not found");
      }

      const updated = await prisma.task.findFirst({
        where: { id: taskId, groupId },
        select: {
          id: true,
          title: true,
          description: true,
          dueAt: true,
          status: true,
          createdAt: true,
          topicId: true,
          createdById: true,
          assigneeId: true,
        },
      });

      res.status(200).json(ok(updated));
    } catch (e) {
      next(e);
    }
  }
);

tasksRouter.delete(
  "/groups/:groupId/tasks/:taskId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const taskId = req.params.taskId;

      const result = await prisma.task.deleteMany({ where: { id: taskId, groupId } });
      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Task not found");
      }

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);
