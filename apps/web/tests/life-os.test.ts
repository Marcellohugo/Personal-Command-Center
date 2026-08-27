import { describe, expect, it } from "vitest";
import { completeEvening, completeMorning, currentStreak, levelFromXp, upsertPriority } from "@/lib/life-os";
import { createEmptyWorkspace } from "@/lib/offline-workspace";

describe("Marco Life OS", () => {
  it("mencatat ritual, streak, Perfect Day, dan XP secara idempotent", () => {
    let workspace = createEmptyWorkspace();
    workspace = completeMorning(workspace, 4, "2026-08-27");
    workspace = completeEvening(workspace, { win: "Selesai", lesson: "Fokus", nextStep: "Ulangi", reflection: "" }, "2026-08-27");
    workspace = completeMorning(workspace, 4, "2026-08-27");
    expect(workspace.gamification.totalXp).toBe(20);
    expect(workspace.gamification.ritualDays).toEqual(["2026-08-27"]);
    expect(workspace.gamification.perfectDays).toEqual(["2026-08-27"]);
    expect(currentStreak(workspace, new Date("2026-08-27T12:00:00"))).toBe(1);
    expect(levelFromXp(500)).toBe(3);
  });

  it("membatasi prioritas harian menjadi tiga", () => {
    let workspace = createEmptyWorkspace();
    for (let index = 0; index < 4; index += 1) workspace = upsertPriority(workspace, { id: String(index), date: "2026-08-27", text: `Prioritas ${index}`, done: false });
    expect(workspace.priorities).toHaveLength(3);
  });
});
