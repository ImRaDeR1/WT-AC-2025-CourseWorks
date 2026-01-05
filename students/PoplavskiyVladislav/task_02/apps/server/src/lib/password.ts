import crypto from "node:crypto";

const SCRYPT_KEYLEN = 32;

export type PasswordHash = string;

const base64url = (buf: Buffer) =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64urlToBuffer = (s: string) => {
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = (s + "=".repeat(padLen)).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
};

// Format: scrypt$<saltB64url>$<hashB64url>
export const hashPassword = async (password: string): Promise<PasswordHash> => {
  const salt = crypto.randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return `scrypt$${base64url(salt)}$${base64url(key)}`;
};

export const verifyPassword = async (
  password: string,
  stored: PasswordHash
): Promise<boolean> => {
  const [algo, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;

  const salt = base64urlToBuffer(saltB64);
  const expected = base64urlToBuffer(hashB64);

  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });

  return crypto.timingSafeEqual(expected, actual);
};
