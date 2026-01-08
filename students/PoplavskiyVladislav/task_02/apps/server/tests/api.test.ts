import "dotenv/config";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const requireEnv = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
};

describe("API", () => {
  it("health works", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("ok");
    expect(res.body?.data?.message).toBe("healthy");
  });

  it("openapi endpoint works", async () => {
    const app = createApp();
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body?.openapi).toBeTruthy();
    expect(res.body?.paths).toBeTruthy();
  });

  it("register/login and topic progress flow works", async () => {
    requireEnv("DATABASE_URL");

    const app = createApp();

    const suffix = String(Date.now());
    const username = `test_${suffix}`;
    const email = `test_${suffix}@example.com`;
    const password = "password123";

    const register = await request(app).post("/auth/register").send({ username, email, password });
    expect([200, 201]).toContain(register.status);

    const login = await request(app).post("/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body?.status).toBe("ok");

    const token = login.body?.data?.accessToken as string | undefined;
    expect(token).toBeTruthy();

    const auth = { Authorization: `Bearer ${token}` };

    const groupRes = await request(app).post("/groups").set(auth).send({ title: `Group ${suffix}`, isPublic: true });
    expect(groupRes.status).toBe(201);
    const groupId = groupRes.body?.data?.id as string;
    expect(groupId).toBeTruthy();

    const topicRes = await request(app).post(`/groups/${groupId}/topics`).set(auth).send({ title: "Topic A" });
    expect(topicRes.status).toBe(201);
    const topicId = topicRes.body?.data?.id as string;
    expect(topicId).toBeTruthy();

    const patchDone = await request(app).patch(`/groups/${groupId}/topics/${topicId}`).set(auth).send({ isDone: true });
    expect(patchDone.status).toBe(200);
    expect(patchDone.body?.data?.isDone).toBe(true);
    expect(patchDone.body?.data?.doneAt).toBeTruthy();

    const patchUndone = await request(app).patch(`/groups/${groupId}/topics/${topicId}`).set(auth).send({ isDone: false });
    expect(patchUndone.status).toBe(200);
    expect(patchUndone.body?.data?.isDone).toBe(false);
    expect(patchUndone.body?.data?.doneAt).toBeNull();
  });
});
