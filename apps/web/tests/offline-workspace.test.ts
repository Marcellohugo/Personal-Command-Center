import { describe, expect, it } from "vitest";
import { loadWorkspace, parseWorkspace, removeById, upsertById } from "@/lib/offline-workspace";

describe("offline workspace", () => {
  it("memulihkan data rusak dan menjalankan CRUD tanpa kehilangan entitas lain", () => {
    expect(loadWorkspace("bukan-json").notes).toEqual([]);
    expect(parseWorkspace("bukan-json")).toBeNull();
    expect(loadWorkspace(JSON.stringify({ notes: [{ id: "valid", title: "Catatan", content: "Isi", pinned: false, updatedAt: "2026-07-19T00:00:00.000Z" }, { id: "invalid-date", title: "Rusak", content: "", pinned: false, updatedAt: "bukan tanggal" }, { id: 9 }] })).notes).toHaveLength(1);

    const notes = upsertById([], { id: "1", title: "Awal" });
    const updated = upsertById(notes, { id: "1", title: "Diubah" });

    expect(updated).toEqual([{ id: "1", title: "Diubah" }]);
    expect(removeById(updated, "1")).toEqual([]);
  });

  it("menyimpan riwayat kebiasaan di workspace dan membuang tanggal tidak valid", () => {
    const workspace = loadWorkspace(JSON.stringify({
      habits: [{ id: "habit-1", name: "Membaca", frequency: "daily", completedDates: ["2026-08-23", "rusak", "2026-08-23"] }]
    }));

    expect(workspace.habits).toEqual([expect.objectContaining({
      id: "habit-1",
      completedDates: ["2026-08-23"]
    })]);
    expect(parseWorkspace(JSON.stringify(workspace))?.habits).toHaveLength(1);
  });

  it("menormalkan data perkembangan dan membatasi nilai yang tidak aman", () => {
    const workspace = loadWorkspace(JSON.stringify({
      version: 3,
      growthGoals: [{ id: "goal", title: "Mahir presentasi", area: "learning", progress: 140, targetDate: "2026-10-01", nextAction: "Latihan", createdAt: "2026-08-24T00:00:00Z" }],
      focusSessions: [{ id: "focus", title: "Latihan", area: "career", minutes: 5000, date: "2026-08-24", note: "Selesai" }],
      dailyReviews: [{ id: "review", date: "2026-08-24", mood: 9, energy: 0, win: "Berani mencoba", lesson: "Latihan membantu", nextStep: "Ulangi" }]
    }));

    expect(workspace.version).toBe(4);
    expect(workspace.growthGoals[0].progress).toBe(100);
    expect(workspace.focusSessions[0].minutes).toBe(1440);
    expect(workspace.dailyReviews[0]).toMatchObject({ mood: 5, energy: 1 });
  });

  it("menormalkan board dan ticket kanban", () => {
    const workspace = loadWorkspace(JSON.stringify({
      version: 4,
      projects: [{ id: "p", name: "Produk", color: "rusak", createdAt: "2026-08-25T00:00:00Z" }],
      tickets: [{ id: "t", projectId: "p", title: "Bangun fitur", status: "in_progress", priority: "urgent", labels: ["ui", "ui"], checklist: [{ id: "c", text: "Uji", done: true }], comments: [], createdAt: "2026-08-25T00:00:00Z", updatedAt: "2026-08-25T00:00:00Z" }]
    }));
    expect(workspace.projects[0].color).toBe("#2563eb");
    expect(workspace.tickets[0]).toMatchObject({ status: "in_progress", priority: "urgent", labels: ["ui"] });
  });

  it("menormalkan metadata keuangan dan notes lanjutan", () => {
    const workspace = loadWorkspace(JSON.stringify({
      version: 5,
      notes: [{ id: "note", title: "Jurnal", content: "Isi", pinned: false, updatedAt: "2026-08-27T00:00:00Z", status: "archived", versions: [{ id: "v1", title: "Awal", content: "Lama", updatedAt: "2026-08-26T00:00:00Z" }], links: [{ type: "transaction", id: "tx" }] }],
      budgetPlans: [{ id: "plan", month: "2026-08", categoryId: "food", planned: 500000 }],
      investments: [{ id: "fund", name: "Dana", kind: "fund", units: 2, costBasis: 100, currentPrice: 120, updatedAt: "2026-08-27T00:00:00Z" }],
      settings: { defaultCurrency: "USD", budgetMethod: "zero_based", budgetRollover: true, lockedFinanceMonths: ["2026-08", "rusak"], paydays: [{ day: 25, amount: 8_000_000 }, { day: 99, amount: -1 }] }
    }));
    expect(workspace.notes[0]).toMatchObject({ status: "archived", versions: [expect.objectContaining({ id: "v1" })], links: [{ type: "transaction", id: "tx" }] });
    expect(workspace.budgetPlans[0].planned).toBe(500000);
    expect(workspace.investments[0].currentPrice).toBe(120);
    expect(workspace.settings).toMatchObject({ defaultCurrency: "USD", budgetMethod: "zero_based", budgetRollover: true, lockedFinanceMonths: ["2026-08"], paydays: [{ day: 25, amount: 8_000_000 }, { day: 31, amount: 0 }] });
  });
});
