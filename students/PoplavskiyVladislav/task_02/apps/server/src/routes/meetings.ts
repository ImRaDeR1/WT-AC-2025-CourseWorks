import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { HttpError, ok } from "../lib/http";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGroupMember, requireGroupOwner } from "../middlewares/requireGroupMember";

export const meetingsRouter = Router();

const calendarQuerySchema = z.object({
  alarmMinutes: z.coerce.number().int().min(0).max(7 * 24 * 60).optional(),
});

const icsEscape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

const formatIcsUtc = (d: Date) => {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
};

const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60 * 1000);

meetingsRouter.get(
  "/groups/:groupId/calendar.ics",
  requireAuth,
  requireGroupMember(),
  async (req, res, next) => {
    try {
      const groupId = req.params.groupId;
      const { alarmMinutes } = calendarQuerySchema.parse(req.query);

      const group = await prisma.studyGroup.findFirst({ where: { id: groupId }, select: { title: true } });
      if (!group) {
        throw new HttpError(404, "not_found", "Group not found");
      }

      const meetings = await prisma.meeting.findMany({
        where: { groupId },
        select: {
          id: true,
          startsAt: true,
          durationMinutes: true,
          place: true,
          link: true,
          notes: true,
          topic: { select: { title: true } },
        },
        orderBy: { startsAt: "asc" },
        take: 500,
      });

      const prodId = "-//Study Groups//Calendar Export//EN";
      const now = new Date();
      const safeTitle = group.title.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
      const filename = `${safeTitle || "study-group"}-${groupId}.ics`;

      const lines: string[] = [];
      lines.push("BEGIN:VCALENDAR");
      lines.push("VERSION:2.0");
      lines.push(`PRODID:${prodId}`);
      lines.push("CALSCALE:GREGORIAN");
      lines.push("METHOD:PUBLISH");
      lines.push(`X-WR-CALNAME:${icsEscape(group.title)}`);
      lines.push("X-WR-TIMEZONE:UTC");

      for (const m of meetings) {
        const dtStart = new Date(m.startsAt);
        const dtEnd = addMinutes(dtStart, m.durationMinutes);
        const summary = m.topic?.title ? `${m.topic.title}` : "Meeting";
        const descriptionParts = [m.notes?.trim(), m.link?.trim()].filter(Boolean) as string[];
        const description = descriptionParts.length ? descriptionParts.join("\n") : undefined;
        const alarm = alarmMinutes ?? 30;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${m.id}@${groupId}`);
        lines.push(`DTSTAMP:${formatIcsUtc(now)}`);
        lines.push(`DTSTART:${formatIcsUtc(dtStart)}`);
        lines.push(`DTEND:${formatIcsUtc(dtEnd)}`);
        lines.push(`SUMMARY:${icsEscape(summary)}`);
        if (m.place) lines.push(`LOCATION:${icsEscape(m.place)}`);
        if (description) lines.push(`DESCRIPTION:${icsEscape(description)}`);
        if (m.link) lines.push(`URL:${icsEscape(m.link)}`);

        if (alarm > 0) {
          lines.push("BEGIN:VALARM");
          lines.push(`TRIGGER:-PT${alarm}M`);
          lines.push("ACTION:DISPLAY");
          lines.push(`DESCRIPTION:${icsEscape(summary)}`);
          lines.push("END:VALARM");
        }

        lines.push("END:VEVENT");
      }

      lines.push("END:VCALENDAR");

      res.status(200);
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
      res.send(lines.join("\r\n"));
    } catch (e) {
      next(e);
    }
  }
);

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
