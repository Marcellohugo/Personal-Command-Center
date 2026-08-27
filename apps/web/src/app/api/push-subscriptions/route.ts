import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestHasSession } from "@/lib/session";

export async function GET(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  return NextResponse.json({ configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "" });
}

export async function POST(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.slice(0, 2048) : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh.slice(0, 512) : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth.slice(0, 512) : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return NextResponse.json({ error: "Push subscription tidak valid." }, { status: 400 });
  const user = await requireCurrentUser();
  await prisma.pushSubscription.upsert({ where: { endpoint }, update: { userId: user.id, p256dh, auth }, create: { userId: user.id, endpoint, p256dh, auth } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Endpoint diperlukan." }, { status: 400 });
  const user = await requireCurrentUser();
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint: body.endpoint } });
  return NextResponse.json({ ok: true });
}
