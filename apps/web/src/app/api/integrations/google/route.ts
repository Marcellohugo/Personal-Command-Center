import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { deleteGoogleEvent, googleConfigured, listGoogleEvents, saveGoogleEvent, scheduleFromGoogle, validGoogleAccessToken } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { openSecret } from "@/lib/secret-box";
import { readCentralWorkspace, writeCentralWorkspace } from "@/lib/server-workspace";
import { requestHasSession } from "@/lib/session";

export async function GET(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const user = await requireCurrentUser();
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { googleRefreshToken: true } });
  return NextResponse.json({ configured: googleConfigured(), connected: Boolean(row?.googleRefreshToken) });
}

export async function POST(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const user = await requireCurrentUser();
  if (!await validGoogleAccessToken(user.id)) return NextResponse.json({ error: "Hubungkan Google Calendar terlebih dahulu." }, { status: 400 });
  try {
    const { data: workspace, revision } = await readCentralWorkspace(user.id);
    for (const eventId of workspace.settings.deletedGoogleEventIds) await deleteGoogleEvent(user.id, eventId);
    workspace.settings.deletedGoogleEventIds = [];
    const remote = await listGoogleEvents(user.id);
    const byId = new Map(remote.map((event) => [event.id, event] as const));
    const byLocalId = new Map<string, (typeof remote)[number]>();
    for (const event of remote) {
      const localId = event.extendedProperties?.private?.pccScheduleId;
      if (localId) byLocalId.set(localId, event);
    }
    workspace.schedules = workspace.schedules.filter((schedule) => {
      const existing = (schedule.googleEventId ? byId.get(schedule.googleEventId) : undefined) || byLocalId.get(schedule.id);
      return schedule.source !== "google_calendar" || existing?.status !== "cancelled";
    });
    for (const schedule of workspace.schedules) {
      const existing = (schedule.googleEventId ? byId.get(schedule.googleEventId) : undefined) || byLocalId.get(schedule.id);
      if (schedule.status === "cancelled") { if (existing?.id) await deleteGoogleEvent(user.id, existing.id); schedule.googleEventId = undefined; continue; }
      if (schedule.source === "google_calendar" && existing && existing.status !== "cancelled") {
        const remoteSchedule = scheduleFromGoogle(existing);
        if (remoteSchedule) Object.assign(schedule, remoteSchedule, { id: schedule.id, linkedNoteId: schedule.linkedNoteId });
        continue;
      }
      schedule.googleEventId = await saveGoogleEvent(user.id, schedule, existing?.status === "cancelled" ? undefined : existing?.id);
    }
    const localIds = new Set(workspace.schedules.map((item) => item.id));
    const googleIds = new Set(workspace.schedules.map((item) => item.googleEventId));
    for (const event of remote) {
      if (event.status === "cancelled" || googleIds.has(event.id)) continue;
      const schedule = scheduleFromGoogle(event);
      if (schedule && !localIds.has(schedule.id)) workspace.schedules.push(schedule);
    }
    await writeCentralWorkspace(user.id, workspace, revision);
    return NextResponse.json({ ok: true, pushed: workspace.schedules.filter((item) => item.googleEventId).length, imported: workspace.schedules.filter((item) => item.source === "google_calendar").length });
  } catch (error) {
    const conflict = error instanceof Error && error.message === "WORKSPACE_CONFLICT";
    return NextResponse.json({ error: conflict ? "Data berubah di perangkat lain. Coba sinkronkan lagi." : error instanceof Error ? error.message : "Sinkronisasi gagal." }, { status: conflict ? 409 : 502 });
  }
}

export async function DELETE(request: Request) {
  if (!await requestHasSession(request)) return NextResponse.json({ error: "Autentikasi diperlukan." }, { status: 401 });
  const user = await requireCurrentUser();
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { googleAccessToken: true } });
  if (row?.googleAccessToken) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(openSecret(row.googleAccessToken))}`, { method: "POST" }).catch(() => null);
  await prisma.user.update({ where: { id: user.id }, data: { googleAccessToken: null, googleRefreshToken: null, googleTokenExpiry: null } });
  return NextResponse.json({ ok: true });
}
