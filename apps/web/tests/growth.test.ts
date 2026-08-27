import { describe, expect, it } from "vitest";
import { dailyMotivation, growthMetrics } from "@/lib/growth";
import { createEmptyWorkspace } from "@/lib/offline-workspace";

describe("growth metrics", () => {
  it("menghitung progres, fokus mingguan, streak, dan pencapaian", () => {
    const metrics = growthMetrics(
      [{ id: "goal", title: "Belajar", area: "learning", progress: 100, targetDate: "2026-09-01", nextAction: "Latihan", createdAt: "2026-08-01T00:00:00Z" }],
      [{ id: "focus", title: "Latihan", area: "learning", minutes: 300, date: "2026-08-24", note: "" }],
      [
        { id: "r1", date: "2026-08-22", mood: 3, energy: 3, win: "", lesson: "", nextStep: "" },
        { id: "r2", date: "2026-08-23", mood: 4, energy: 4, win: "", lesson: "", nextStep: "" },
        { id: "r3", date: "2026-08-24", mood: 5, energy: 5, win: "", lesson: "", nextStep: "" }
      ],
      new Date(2026, 7, 24)
    );

    expect(metrics).toMatchObject({ completedGoals: 1, weeklyMinutes: 300, reviewStreak: 3, averageMood: 4, growthScore: 91 });
    expect(metrics.achievements).toEqual(["Langkah pertama", "Momentum 100 menit", "Refleksi konsisten", "Goal getter", "Fokus 5 jam"]);
  });

  it("memilih langkah perkembangan sebagai misi utama hari ini", () => {
    const workspace = createEmptyWorkspace();
    workspace.growthGoals = [{ id: "goal", title: "Naik level", area: "career", progress: 40, targetDate: "2026-09-01", nextAction: "Selesaikan satu latihan", createdAt: "2026-08-01T00:00:00Z" }];
    workspace.habits = [{ id: "habit", name: "Baca", frequency: "daily", completedDates: [], createdAt: "2026-08-01T00:00:00Z" }];

    expect(dailyMotivation(workspace, new Date(2026, 7, 24, 9))).toMatchObject({
      greeting: "Selamat pagi",
      mission: "Selesaikan satu latihan",
      target: "perkembangan",
      totalToday: 1,
      goalProgress: 40
    });
  });
});
