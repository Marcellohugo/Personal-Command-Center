import { NextResponse } from "next/server";
import { currentPasswordConfig, candidateMatches, loginRetryAfter, persistPassword, recordLoginResult, requestHasSession, SESSION_COOKIE, sessionToken } from "@/lib/session";

export async function POST(request: Request) {
  const config = await currentPasswordConfig();
  const secret = process.env.APP_SESSION_SECRET || "marco-life-os-session-secret-change-me";

  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const retryAfter = loginRetryAfter(client);
  if (retryAfter) return NextResponse.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${retryAfter} detik.` }, { status: 429, headers: { "Retry-After": String(retryAfter) } });

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const candidate = typeof body?.password === "string" ? body.password : "";
  const accepted = await candidateMatches(candidate, config, secret);
  recordLoginResult(client, accepted);
  if (!accepted) {
    const blockedFor = loginRetryAfter(client);
    if (blockedFor) return NextResponse.json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${blockedFor} detik.` }, { status: 429, headers: { "Retry-After": String(blockedFor) } });
    return NextResponse.json({ error: "Kode akses salah." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  await persistPassword(candidate);
  const stored = await currentPasswordConfig();
  response.cookies.set(SESSION_COOKIE, await sessionToken(stored.verifier, secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}

export async function PATCH(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const body = await request.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown } | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8 || newPassword.length > 128) return NextResponse.json({ error: "Password baru harus 8–128 karakter." }, { status: 400 });
  const config = await currentPasswordConfig();
  const secret = process.env.APP_SESSION_SECRET || "marco-life-os-session-secret-change-me";
  if (!await candidateMatches(currentPassword, config, secret)) return NextResponse.json({ error: "Password saat ini salah." }, { status: 401 });
  await persistPassword(newPassword);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await sessionToken(await currentPasswordConfig().then((value) => value.verifier), secret), { httpOnly: true, sameSite: "strict", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return response;
}

export function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
