import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { HttpError, ok } from "../lib/http";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGroupMember, requireGroupOwner } from "../middlewares/requireGroupMember";

export const materialsRouter = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
});

const materialTypeSchema = z.enum(["link", "file", "note"]);

const createMaterialSchema = z
  .object({
    title: z.string().min(1).max(200),
    type: materialTypeSchema,
    url: z.string().max(2000).optional(),
    content: z.string().max(20000).optional(),
    topicId: z.string().uuid().optional(),
  })
  .refine(
    (v) => {
      if (v.type === "link") return Boolean(v.url);
      if (v.type === "note") return Boolean(v.content);
      return true;
    },
    { message: "url/content is required for the selected type" }
  );

materialsRouter.get(
  "/groups/:groupId/materials",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const { limit, offset } = listQuerySchema.parse(req.query);

      const materials = await prisma.material.findMany({
        where: { groupId },
        select: {
          id: true,
          title: true,
          type: true,
          url: true,
          content: true,
          topicId: true,
          createdAt: true,
          createdById: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit ?? 50,
        skip: offset ?? 0,
      });

      res.status(200).json(ok(materials));
    } catch (e) {
      next(e);
    }
  }
);

materialsRouter.post(
  "/groups/:groupId/materials",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const createdById = req.auth!.userId;
      const data = createMaterialSchema.parse(req.body);

      if (data.topicId) {
        const topic = await prisma.topic.findFirst({ where: { id: data.topicId, groupId }, select: { id: true } });
        if (!topic) {
          throw new HttpError(400, "bad_request", "topicId is not in this group");
        }
      }

      const created = await prisma.material.create({
        data: {
          groupId,
          createdById,
          title: data.title,
          type: data.type,
          url: data.url,
          content: data.content,
          topicId: data.topicId,
        },
        select: {
          id: true,
          title: true,
          type: true,
          url: true,
          content: true,
          topicId: true,
          createdAt: true,
          createdById: true,
        },
      });

      res.status(201).json(ok(created));
    } catch (e) {
      next(e);
    }
  }
);

const updateMaterialSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    url: z.string().max(2000).nullable().optional(),
    content: z.string().max(20000).nullable().optional(),
    topicId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

materialsRouter.patch(
  "/groups/:groupId/materials/:materialId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const materialId = req.params.materialId;
      const patch = updateMaterialSchema.parse(req.body);

      if (patch.topicId) {
        const topic = await prisma.topic.findFirst({ where: { id: patch.topicId, groupId }, select: { id: true } });
        if (!topic) {
          throw new HttpError(400, "bad_request", "topicId is not in this group");
        }
      }

      const result = await prisma.material.updateMany({
        where: { id: materialId, groupId },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.url !== undefined ? { url: patch.url } : {}),
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.topicId !== undefined ? { topicId: patch.topicId } : {}),
        },
      });

      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Material not found");
      }

      const updated = await prisma.material.findFirst({
        where: { id: materialId, groupId },
        select: {
          id: true,
          title: true,
          type: true,
          url: true,
          content: true,
          topicId: true,
          createdAt: true,
          createdById: true,
        },
      });

      res.status(200).json(ok(updated));
    } catch (e) {
      next(e);
    }
  }
);

materialsRouter.delete(
  "/groups/:groupId/materials/:materialId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const materialId = req.params.materialId;

      const result = await prisma.material.deleteMany({ where: { id: materialId, groupId } });
      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Material not found");
      }

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);
