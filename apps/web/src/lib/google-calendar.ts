import "server-only";
import { prisma } from "@/lib/prisma";
import { openSecret, sealSecret } from "@/lib/secret-box";
import type { WorkspaceSchedule } from "@/lib/offline-workspace";

export type GoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: { pccScheduleId?: string } };
};

export function googleConfigured() {
  return process.env.GOOGLE_CALENDAR_ENABLED === "true" && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleEvent(schedule: WorkspaceSchedule) {
  const timezone = process.env.GOOGLE_CALENDAR_TIMEZONE || process.env.TZ || "Asia/Bangkok";
  const endTime = schedule.endTime || (() => {
    const [hours, minutes] = schedule.startTime.split(":").map(Number);
    const total = hours * 60 + minutes + 60;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  })();
  const recurrence = schedule.recurrence === "none" ? undefined : [`RRULE:FREQ=${schedule.recurrence.toUpperCase()}`];
  return {
    summary: schedule.title,
    description: schedule.description,
    location: schedule.location || "",
    start: { dateTime: `${schedule.date.slice(0, 10)}T${schedule.startTime}:00`, timeZone: timezone },
    end: { dateTime: `${schedule.date.slice(0, 10)}T${endTime}:00`, timeZone: timezone },
    recurrence,
    reminders: schedule.reminderMinutes ? { useDefault: false, overrides: [{ method: "popup", minutes: schedule.reminderMinutes }] } : { useDefault: true },
    extendedProperties: { private: { pccScheduleId: schedule.id } }
  };
}

export async function validGoogleAccessToken(userId: string) {
  if (!googleConfigured()) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true } });
  if (!user?.googleRefreshToken) return null;
  if (user.googleAccessToken && user.googleTokenExpiry && user.googleTokenExpiry.getTime() > Date.now() + 120_000) return openSecret(user.googleAccessToken);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: openSecret(user.googleRefreshToken), grant_type: "refresh_token" }), cache: "no-store" });
  if (!response.ok) return null;
  const token = await response.json() as { access_token: string; expires_in: number };
  await prisma.user.update({ where: { id: userId }, data: { googleAccessToken: sealSecret(token.access_token), googleTokenExpiry: new Date(Date.now() + token.expires_in * 1000) } });
  return token.access_token;
}

async function calendarRequest(userId: string, path: string, init?: RequestInit) {
  const accessToken = await validGoogleAccessToken(userId);
  if (!accessToken) throw new Error("Google Calendar belum terhubung.");
  return fetch(`https://www.googleapis.com/calendar/v3/calendars/primary${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
}

export async function listGoogleEvents(userId: string) {
  const params = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "2500", timeMin: new Date(Date.now() - 366 * 86400000).toISOString(), timeMax: new Date(Date.now() + 730 * 86400000).toISOString() });
  const response = await calendarRequest(userId, `/events?${params}`);
  if (!response.ok) throw new Error("Gagal membaca Google Calendar.");
  return (await response.json() as { items?: GoogleEvent[] }).items || [];
}

export async function saveGoogleEvent(userId: string, schedule: WorkspaceSchedule, eventId?: string) {
  const path = eventId ? `/events/${encodeURIComponent(eventId)}` : "/events";
  const response = await calendarRequest(userId, path, { method: eventId ? "PATCH" : "POST", body: JSON.stringify(buildGoogleEvent(schedule)) });
  if (!response.ok) throw new Error("Gagal menyimpan agenda ke Google Calendar.");
  return (await response.json() as GoogleEvent).id;
}

export async function deleteGoogleEvent(userId: string, eventId: string) {
  const response = await calendarRequest(userId, `/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error("Gagal menghapus agenda Google.");
}

export function scheduleFromGoogle(event: GoogleEvent): WorkspaceSchedule | null {
  const start = event.start?.dateTime || event.start?.date;
  if (!start || !event.id) return null;
  const date = start.slice(0, 10);
  const startTime = event.start?.dateTime?.slice(11, 16) || "09:00";
  const endTime = event.end?.dateTime?.slice(11, 16);
  return { id: event.extendedProperties?.private?.pccScheduleId || `google-${event.id}`, googleEventId: event.id, source: "google_calendar", title: event.summary || "Agenda Google", description: event.description || "", location: event.location, date, startTime, endTime, status: "planned", recurrence: "none" };
}
