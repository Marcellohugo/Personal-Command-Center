import { addDays, differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import { dayRange, weekRange } from "@/lib/date";

export type HabitFrequency = "daily" | "weekly";

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

export function calculateBestStreak(logs: Array<{ completedAt: Date }>) {
  if (logs.length === 0) {
    return 0;
  }

  const uniqueDays = Array.from(
    new Set(logs.map((log) => startOfDay(log.completedAt).toISOString()))
  )
    .map((iso) => new Date(iso))
    .sort((a, b) => a.getTime() - b.getTime());

  let best = 1;
  let current = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    if (differenceInCalendarDays(uniqueDays[i], uniqueDays[i - 1]) === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

export function habitCompletionRange(frequency: HabitFrequency, now = new Date()) {
  return frequency === "weekly" ? weekRange(now) : dayRange(now);
}

export function isHabitCompleted(
  habit: { frequency: HabitFrequency; logs: Array<{ completedAt: Date }> },
  now = new Date()
) {
  const range = habitCompletionRange(habit.frequency, now);
  return habit.logs.some((log) => log.completedAt >= range.gte && log.completedAt <= range.lte);
}

export function buildNextWeekLabels(now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => addDays(startOfDay(now), index));
}
