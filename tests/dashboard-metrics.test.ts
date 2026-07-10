import { describe, expect, it } from "vitest";
import {
  buildDashboardMetrics,
  buildExpenseCategoryChart,
  calculateExpenseTotals
} from "@/lib/dashboard";

describe("dashboard helpers", () => {
  it("calculates daily weekly and monthly totals from expense dates", () => {
    const totals = calculateExpenseTotals(
      [
        { amount: 25000, date: new Date("2026-04-24T03:00:00.000Z") },
        { amount: 10000, date: new Date("2026-04-22T03:00:00.000Z") },
        { amount: 50000, date: new Date("2026-04-01T03:00:00.000Z") },
        { amount: 70000, date: new Date("2026-03-31T03:00:00.000Z") }
      ],
      new Date("2026-04-24T08:00:00.000Z")
    );

    expect(totals).toEqual({
      today: 25000,
      week: 35000,
      month: 85000
    });
  });

  it("groups expense amounts by category for charts", () => {
    const chart = buildExpenseCategoryChart([
      { amount: 25000, category: "Makanan & Minuman" },
      { amount: 15000, category: "Makanan & Minuman" },
      { amount: 10000, category: "Transportasi" }
    ]);

    expect(chart).toEqual([
      { category: "Makanan & Minuman", total: 40000 },
      { category: "Transportasi", total: 10000 }
    ]);
  });

  it("builds dashboard counts and totals", () => {
    const metrics = buildDashboardMetrics({
      schedules: [{ id: "schedule-1" }, { id: "schedule-2" }],
      expenses: [{ amount: 25000, date: new Date("2026-04-24T02:00:00.000Z") }],
      habits: [
        { id: "habit-1", logs: [] },
        { id: "habit-2", logs: [{ completedAt: new Date("2026-04-24T04:00:00.000Z") }] }
      ],
      dailySummary: "Rapat bimbingan, kopi, dan belajar.",
      now: new Date("2026-04-24T08:00:00.000Z")
    });

    expect(metrics).toEqual({
      todayScheduleCount: 2,
      todayExpenseTotal: 25000,
      monthExpenseTotal: 25000,
      incompleteHabitCount: 1,
      dailySummary: "Rapat bimbingan, kopi, dan belajar."
    });
  });
});
