import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const SCRYPT_KEYLEN = 32;

const base64url = (buf: Buffer) =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

// Format: scrypt$<saltB64url>$<hashB64url>
const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt$${base64url(salt)}$${base64url(key)}`;
};

const prisma = new PrismaClient();

async function main() {
  const demoPasswordHash = await hashPassword("password123");

  // users
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      username: "admin",
      email: "admin@example.com",
      passwordHash: demoPasswordHash,
      role: "admin",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      username: "user",
      email: "user@example.com",
      passwordHash: demoPasswordHash,
      role: "user",
    },
  });

  // group + owner membership
  const group = await prisma.studyGroup.upsert({
    where: { id: "00000000-0000-0000-0000-000000000042" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000042",
      title: "Подготовка к экзамену",
      description: "Демо-группа для варианта 42",
      isPublic: true,
      ownerId: user.id,
      memberships: {
        create: [{ userId: user.id, role: "owner" }],
      },
    },
  });

  const topic = await prisma.topic.create({
    data: {
      groupId: group.id,
      title: "Тема 1: Базы данных",
      description: "ERD, миграции, индексы",
      order: 1,
    },
  });

  await prisma.meeting.create({
    data: {
      groupId: group.id,
      topicId: topic.id,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      durationMinutes: 90,
      place: "Онлайн",
      link: "https://example.com/meeting",
      notes: "Демо-встреча",
    },
  });

  await prisma.material.create({
    data: {
      groupId: group.id,
      topicId: topic.id,
      title: "Конспект по ERD",
      type: "note",
      content: "Сущности: User, StudyGroup, Membership, Topic, Meeting, Material, Task.",
      createdById: admin.id,
    },
  });

  await prisma.task.create({
    data: {
      groupId: group.id,
      topicId: topic.id,
      title: "Сделать ERD",
      description: "Подготовить диаграмму сущностей и связей",
      status: "todo",
      dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      createdById: user.id,
      assigneeId: user.id,
    },
  });

  // eslint-disable-next-line no-console
  console.log("Seed completed");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
