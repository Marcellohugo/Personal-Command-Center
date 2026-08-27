import { NextResponse } from "next/server";
import webpush from "web-push";
import { loadWorkspace } from "@/lib/offline-workspace";
import { prisma } from "@/lib/prisma";

function currentTime(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, weekday: get("weekday") };
}

function weekStart(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1));
  return value.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret || request.headers.get("authorization") !== `Bearer ${configuredSecret}`) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return NextResponse.json({ error: "VAPID belum dikonfigurasi." }, { status: 503 });
  webpush.setVapidDetails(`mailto:${process.env.APP_USER_EMAIL || "marco.marcello15@gmail.com"}`, publicKey, privateKey);
  const users = await prisma.user.findMany({ include: { workspaceSnapshot: true, pushSubscriptions: true } });
  let sent = 0;
  for (const user of users) {
    if (!user.workspaceSnapshot || !user.pushSubscriptions.length) continue;
    const workspace = loadWorkspace(JSON.stringify(user.workspaceSnapshot.data));
    let now;
    try {
      now = currentTime(workspace.settings.timezone || "Asia/Bangkok");
    } catch {
      now = currentTime("Asia/Bangkok");
    }
    const checkIn = workspace.checkIns.find((item) => item.date.slice(0, 10) === now.date);
    const currentWeekStart = weekStart(now.date);
    const notifications = [
      workspace.settings.morningReminder === now.time && !checkIn?.morningCompletedAt ? { title: "Ritual pagi", body: "Tentukan energi dan tiga prioritasmu.", tag: `morning-${now.date}` } : null,
      workspace.settings.eveningReminder === now.time && !checkIn?.eveningCompletedAt ? { title: "Ritual malam", body: "Catat kemenangan, pelajaran, dan langkah besok.", tag: `evening-${now.date}` } : null,
      now.weekday === "Sun" && workspace.settings.weeklyReviewReminder === now.time && !workspace.weeklyReviews.some((item) => item.weekStart === currentWeekStart) ? { title: "Review mingguan", body: "Lima menit untuk melihat progres dan memilih fokus berikutnya.", tag: `weekly-${currentWeekStart}` } : null
    ].filter((item): item is { title: string; body: string; tag: string } => Boolean(item));
    for (const subscription of user.pushSubscriptions) {
      for (const notification of notifications) {
        try {
          await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ ...notification, url: "/dashboard" }));
          sent += 1;
        } catch (error) {
          const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
          if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } });
        }
      }
    }
  }
  return NextResponse.json({ ok: true, sent });
}
