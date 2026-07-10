import { addDays, isSameDay, startOfDay, subDays } from "date-fns";

export function calculateDailyStreak(logs: Array<{ completedAt: Date }>, now = new Date()) {
  const completedDays = new Set(
    logs.map((log) => startOfDay(log.completedAt).toISOString())
  );

  let streak = 0;
  let cursor = startOfDay(now);

  while (completedDays.has(cursor.toISOString())) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

export function isCompletedToday(logs: Array<{ completedAt: Date }>, now = new Date()) {
  return logs.some((log) => isSameDay(log.completedAt, now));
}

export function buildNextWeekLabels(now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => addDays(startOfDay(now), index));
}
