import crypto from "node:crypto";

import { HttpError } from "./http";

const base64urlEncode = (input: Buffer | string) => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const base64urlDecodeToString = (s: string) => {
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = (s + "=".repeat(padLen)).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
};

const hmacSha256 = (data: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(data).digest();

const getJwtSecret = () => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new HttpError(500, "config_error", "JWT_ACCESS_SECRET is not set");
  }
  return secret;
};

export type AccessTokenPayload = {
  sub: string; // userId
  role: "admin" | "user";
  exp: number; // unix seconds
};

export const signAccessToken = (payload: Omit<AccessTokenPayload, "exp">) => {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  const headerPart = base64urlEncode(JSON.stringify(header));
  const payloadPart = base64urlEncode(JSON.stringify({ ...payload, exp }));
  const data = `${headerPart}.${payloadPart}`;

  const sig = base64urlEncode(hmacSha256(data, getJwtSecret()));
  return `${data}.${sig}`;
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new HttpError(401, "unauthorized", "Invalid token");
  }

  const [headerPart, payloadPart, sigPart] = parts;
  const data = `${headerPart}.${payloadPart}`;

  const expected = base64urlEncode(hmacSha256(data, getJwtSecret()));
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sigPart))) {
    throw new HttpError(401, "unauthorized", "Invalid token");
  }

  const payloadJson = base64urlDecodeToString(payloadPart);
  const payload = JSON.parse(payloadJson) as Partial<AccessTokenPayload>;

  if (typeof payload.sub !== "string") {
    throw new HttpError(401, "unauthorized", "Invalid token payload");
  }
  if (payload.role !== "admin" && payload.role !== "user") {
    throw new HttpError(401, "unauthorized", "Invalid token payload");
  }
  if (typeof payload.exp !== "number") {
    throw new HttpError(401, "unauthorized", "Invalid token payload");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "unauthorized", "Token expired");
  }

  return payload as AccessTokenPayload;
};

export const getBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader) return null;
  const [type, token] = authorizationHeader.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};
