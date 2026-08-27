"use client";

import { startOfDay, subDays, format, isSameDay } from "date-fns";

type HeatmapProps = {
  logs: Array<{ completedAt: Date }>;
  weeksToShow?: number;
};

export function HabitHeatmap({ logs, weeksToShow = 12 }: HeatmapProps) {
  const today = startOfDay(new Date());
  const totalDays = weeksToShow * 7;
  const startDate = subDays(today, totalDays - 1);

  const completedSet = new Set(
    logs.map((log) => startOfDay(log.completedAt).toISOString())
  );

  const days: Array<{ date: Date; completed: boolean }> = [];
  for (let i = 0; i < totalDays; i++) {
    const date = subDays(today, totalDays - 1 - i);
    days.push({
      date,
      completed: completedSet.has(startOfDay(date).toISOString())
    });
  }

  // Pad the beginning so the grid aligns to weekday rows
  const startDayOfWeek = startDate.getDay(); // 0=Sun
  const padding: Array<null> = Array.from({ length: startDayOfWeek }, () => null);
  const paddedDays: Array<null | { date: Date; completed: boolean }> = [...padding, ...days];

  return (
    <div className="mt-3">
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateRows: "repeat(7, 1fr)",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(0, 1fr)"
        }}
      >
        {paddedDays.map((day, index) =>
          day === null ? (
            <div key={`pad-${index}`} className="h-3 w-3" />
          ) : (
            <div
              key={day.date.toISOString()}
              className={`h-3 w-3 rounded-sm transition-colors ${
                day.completed
                  ? isSameDay(day.date, today)
                    ? "bg-moss"
                    : "bg-moss/60"
                  : "bg-line/30 dark:bg-line/10"
              }`}
              title={`${format(day.date, "dd MMM yyyy")}${day.completed ? " ✓" : ""}`}
            />
          )
        )}
      </div>
    </div>
  );
}
