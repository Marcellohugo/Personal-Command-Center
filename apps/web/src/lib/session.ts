import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "pcc_session";
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_BLOCK_MS = 60_000;
const DEFAULT_PASSWORD = "123456";
const DEFAULT_SESSION_SECRET = "marco-life-os-session-secret-change-me";
const loginAttempts = new Map<string, { failures: number; blockedUntil: number }>();

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", bytes(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(value: string, secret: string) {
  return digest(`${value}\0${secret}`);
}

async function passwordConfig() {
  const raw = process.env.APP_PASSWORD || DEFAULT_PASSWORD;
  try {
    const row = await prisma.user.findUnique({ where: { email: process.env.APP_USER_EMAIL || "demo@example.com" }, select: { passwordHash: true } });
    if (row?.passwordHash) return { verifier: row.passwordHash, hashed: true };
  } catch {
    // The login route remains usable before the database is migrated.
  }
  return { verifier: raw, hashed: false };
}

export async function sessionToken(passwordOrHash: string, secret: string) {
  return digest(`${passwordOrHash}\0${secret}`);
}

export async function passwordMatches(candidate: string, expected: string) {
  const [left, right] = await Promise.all([digest(candidate), digest(expected)]);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function candidateMatches(candidate: string, config: { verifier: string; hashed: boolean }, secret: string) {
  return config.hashed ? passwordMatches(await passwordHash(candidate, secret), config.verifier) : passwordMatches(candidate, config.verifier);
}

export async function persistPassword(candidate: string) {
  try {
    await prisma.user.upsert({
      where: { email: process.env.APP_USER_EMAIL || "demo@example.com" },
      update: { passwordHash: await passwordHash(candidate, process.env.APP_SESSION_SECRET || DEFAULT_SESSION_SECRET) },
      create: { email: process.env.APP_USER_EMAIL || "demo@example.com", name: process.env.APP_USER_NAME || "Pengguna Utama", passwordHash: await passwordHash(candidate, process.env.APP_SESSION_SECRET || DEFAULT_SESSION_SECRET) }
    });
  } catch {
    // Keep APP_PASSWORD as a safe fallback when the database is unavailable.
  }
}

export async function requestHasSession(request: Request) {
  const config = await passwordConfig();
  const secret = process.env.APP_SESSION_SECRET || DEFAULT_SESSION_SECRET;
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ") && await candidateMatches(authorization.slice(7), config, secret)) return true;
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!cookie) return false;
  return passwordMatches(cookie, await sessionToken(config.verifier, secret));
}

export async function currentPasswordConfig() {
  return passwordConfig();
}

export function loginRetryAfter(key: string, now = Date.now()) {
  const blockedUntil = loginAttempts.get(key)?.blockedUntil ?? 0;
  return blockedUntil > now ? Math.ceil((blockedUntil - now) / 1000) : 0;
}

export function recordLoginResult(key: string, accepted: boolean, now = Date.now()) {
  if (accepted) {
    loginAttempts.delete(key);
    return;
  }
  const previous = loginAttempts.get(key);
  const failures = (previous?.blockedUntil ?? 0) > now ? previous!.failures : (previous?.failures ?? 0) + 1;
  loginAttempts.set(key, failures >= LOGIN_FAILURE_LIMIT ? { failures: 0, blockedUntil: now + LOGIN_BLOCK_MS } : { failures, blockedUntil: 0 });
}
