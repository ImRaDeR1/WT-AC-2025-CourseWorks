import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { HttpError, ok } from "../lib/http";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGroupMember, requireGroupOwner } from "../middlewares/requireGroupMember";

export const meetingsRouter = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100000).optional(),
});

const createMeetingSchema = z.object({
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(1).max(24 * 60),
  place: z.string().max(500).optional(),
  link: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  topicId: z.string().uuid().optional(),
});

meetingsRouter.get(
  "/groups/:groupId/meetings",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const { limit, offset } = listQuerySchema.parse(req.query);

      const meetings = await prisma.meeting.findMany({
        where: { groupId },
        select: {
          id: true,
          startsAt: true,
          durationMinutes: true,
          place: true,
          link: true,
          notes: true,
          topicId: true,
        },
        orderBy: { startsAt: "asc" },
        take: limit ?? 50,
        skip: offset ?? 0,
      });

      res.status(200).json(ok(meetings));
    } catch (e) {
      next(e);
    }
  }
);

meetingsRouter.post(
  "/groups/:groupId/meetings",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const data = createMeetingSchema.parse(req.body);

      if (data.topicId) {
        const topic = await prisma.topic.findFirst({ where: { id: data.topicId, groupId }, select: { id: true } });
        if (!topic) {
          throw new HttpError(400, "bad_request", "topicId is not in this group");
        }
      }

      const created = await prisma.meeting.create({
        data: {
          groupId,
          startsAt: new Date(data.startsAt),
          durationMinutes: data.durationMinutes,
          place: data.place,
          link: data.link,
          notes: data.notes,
          topicId: data.topicId,
        },
        select: {
          id: true,
          startsAt: true,
          durationMinutes: true,
          place: true,
          link: true,
          notes: true,
          topicId: true,
        },
      });

      res.status(201).json(ok(created));
    } catch (e) {
      next(e);
    }
  }
);

const updateMeetingSchema = z
  .object({
    startsAt: z.string().datetime().optional(),
    durationMinutes: z.number().int().min(1).max(24 * 60).optional(),
    place: z.string().max(500).nullable().optional(),
    link: z.string().max(2000).nullable().optional(),
    notes: z.string().max(5000).nullable().optional(),
    topicId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field is required" });

meetingsRouter.patch(
  "/groups/:groupId/meetings/:meetingId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const meetingId = req.params.meetingId;
      const patch = updateMeetingSchema.parse(req.body);

      if (patch.topicId) {
        const topic = await prisma.topic.findFirst({ where: { id: patch.topicId, groupId }, select: { id: true } });
        if (!topic) {
          throw new HttpError(400, "bad_request", "topicId is not in this group");
        }
      }

      const result = await prisma.meeting.updateMany({
        where: { id: meetingId, groupId },
        data: {
          ...(patch.startsAt !== undefined ? { startsAt: new Date(patch.startsAt) } : {}),
          ...(patch.durationMinutes !== undefined ? { durationMinutes: patch.durationMinutes } : {}),
          ...(patch.place !== undefined ? { place: patch.place } : {}),
          ...(patch.link !== undefined ? { link: patch.link } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.topicId !== undefined ? { topicId: patch.topicId } : {}),
        },
      });

      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Meeting not found");
      }

      const updated = await prisma.meeting.findFirst({
        where: { id: meetingId, groupId },
        select: {
          id: true,
          startsAt: true,
          durationMinutes: true,
          place: true,
          link: true,
          notes: true,
          topicId: true,
        },
      });

      res.status(200).json(ok(updated));
    } catch (e) {
      next(e);
    }
  }
);

meetingsRouter.delete(
  "/groups/:groupId/meetings/:meetingId",
  requireAuth,
  requireGroupOwner(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const meetingId = req.params.meetingId;

      const result = await prisma.meeting.deleteMany({ where: { id: meetingId, groupId } });
      if (result.count === 0) {
        throw new HttpError(404, "not_found", "Meeting not found");
      }

      res.status(204).end();
    } catch (e) {
      next(e);
    }
  }
);
