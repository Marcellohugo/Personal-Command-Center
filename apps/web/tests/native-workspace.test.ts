import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "@/lib/offline-workspace";
import { mergeNativeWorkspace, nativeFromWorkspace, normalizeNativeWorkspace } from "@/lib/native-workspace";

describe("native workspace sync", () => {
  it("memvalidasi data native dan mempertahankan fitur web tambahan", () => {
    const web = createEmptyWorkspace();
    web.moneySources.push({ id: "cash", name: "Tunai", type: "cash", balance: 100 });
    web.growthGoals.push({ id: "growth", title: "Tetap bertumbuh", area: "personal", progress: 20, targetDate: "", nextAction: "Evaluasi", createdAt: "2026-08-24T00:00:00Z" });
    web.transactions.push({ id: "transfer", kind: "transfer", amount: 25, date: "2026-08-24", sourceId: "cash", note: "Pindah", createdAt: "2026-08-24T00:00:00.000Z" });
    const native = normalizeNativeWorkspace({
      version: 2,
      transactions: [{ id: "income", title: "Honor", amount: 500, isIncome: true, date: "2026-08-24" }],
      agenda: [],
      notes: [],
      habits: [{ id: "water", name: "Minum", completedDates: ["2026-08-24"] }],
      settings: { monthlyBudget: 1000, hideBalances: true }
    });
    expect(native).not.toBeNull();
    const merged = mergeNativeWorkspace(native!, web);
    expect(merged.moneySources).toHaveLength(1);
    expect(merged.transactions.map(({ id }) => id)).toEqual(["transfer", "income"]);
    expect(nativeFromWorkspace(merged).transactions[0].title).toBe("Honor");
    expect(merged.settings.hideBalances).toBe(true);
    expect(merged.growthGoals[0].title).toBe("Tetap bertumbuh");
    expect(nativeFromWorkspace(merged).version).toBe(5);
  });

  it("menyinkronkan proyek dan ticket dari klien versi 4", () => {
    const native = normalizeNativeWorkspace({
      version: 4, transactions: [], agenda: [], notes: [], habits: [], growthGoals: [], focusSessions: [], dailyReviews: [],
      projects: [{ id: "project", name: "Peluncuran", description: "", color: "#2563eb", archived: false, createdAt: "2026-08-25T00:00:00Z" }],
      tickets: [{ id: "ticket", projectId: "project", title: "Uji aplikasi", description: "", status: "review", priority: "high", labels: ["rilis"], dueDate: "2026-09-01", checklist: [{ id: "check", text: "Uji web", done: true }], comments: [{ id: "comment", body: "Siap", createdAt: "2026-08-25T01:00:00Z" }], archived: false, order: 1, createdAt: "2026-08-25T00:00:00Z", updatedAt: "2026-08-25T01:00:00Z" }],
      settings: { monthlyBudget: 0, hideBalances: false }
    });
    expect(native).not.toBeNull();
    const merged = mergeNativeWorkspace(native!, createEmptyWorkspace());
    expect(merged.projects[0].name).toBe("Peluncuran");
    expect(merged.tickets[0]).toMatchObject({ status: "review", priority: "high" });
    expect(merged.tickets[0].checklist[0].done).toBe(true);
  });

  it("menyinkronkan fitur perkembangan dari klien native versi terbaru", () => {
    const native = normalizeNativeWorkspace({
      version: 3,
      transactions: [], agenda: [], notes: [], habits: [],
      growthGoals: [{ id: "goal", title: "Naik level", area: "career", progress: 45, targetDate: "2026-10-01", nextAction: "Latihan", createdAt: "2026-08-24T00:00:00Z" }],
      focusSessions: [{ id: "focus", title: "Deep work", area: "career", minutes: 60, date: "2026-08-24", note: "Selesai" }],
      dailyReviews: [{ id: "review", date: "2026-08-24", mood: 4, energy: 5, win: "Fokus", lesson: "Matikan notifikasi", nextStep: "Ulangi" }],
      settings: { monthlyBudget: 0, hideBalances: false }
    });

    expect(native).not.toBeNull();
    const merged = mergeNativeWorkspace(native!, createEmptyWorkspace());
    expect(merged.growthGoals).toHaveLength(1);
    expect(merged.focusSessions[0].minutes).toBe(60);
    expect(merged.dailyReviews[0].nextStep).toBe("Ulangi");
  });

  it("menolak payload tidak valid", () => {
    expect(normalizeNativeWorkspace({ version: 2, transactions: [], agenda: [], notes: [], habits: [] })).not.toBeNull();
    expect(normalizeNativeWorkspace({ version: 2, transactions: [{ id: "x" }], agenda: [], notes: [], habits: [] })).toBeNull();
  });
});
