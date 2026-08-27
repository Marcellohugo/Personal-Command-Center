import { describe, expect, it } from "vitest";
import { createEmptyWorkspace, type Transaction } from "@/lib/offline-workspace";
import { advanceRecurringDate, moveGoalFunds, putTransaction, removeTransaction, runWorkspaceAutomation } from "@/lib/workspace-finance";

describe("workspace finance", () => {
  it("memperbarui saldo dan menjalankan transaksi berkala jatuh tempo", () => {
    const workspace = {
      ...createEmptyWorkspace(),
      moneySources: [{ id: "cash", name: "Tunai", type: "cash" as const, balance: 100_000 }]
    };
    const expense: Transaction = {
      id: "expense",
      kind: "expense",
      amount: 25_000,
      date: "2026-07-19",
      sourceId: "cash",
      note: "Makan",
      createdAt: "2026-07-19T00:00:00.000Z"
    };

    expect(putTransaction(workspace, expense).moneySources[0].balance).toBe(75_000);
    const edited = { ...expense, amount: 10_000 };
    const afterEdit = putTransaction(putTransaction(workspace, expense), edited, expense);
    expect(afterEdit.moneySources[0].balance).toBe(90_000);
    expect(removeTransaction(afterEdit, edited.id).moneySources[0].balance).toBe(100_000);

    const automated = runWorkspaceAutomation({
      ...workspace,
      recurringItems: [{
        id: "bill",
        name: "Internet",
        kind: "payment",
        amount: 20_000,
        frequency: "monthly",
        nextDate: "2026-07-01",
        sourceId: "cash",
        destination: "ISP",
        autoPost: true
      }]
    }, "2026-07-19");

    expect(automated.workspace.transactions).toHaveLength(1);
    expect(automated.workspace.recurringItems[0].nextDate).toBe("2026-08-01");
    expect(advanceRecurringDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("memindahkan saldo ke hutang dan tujuan tabungan tanpa menggandakan nilai", () => {
    const workspace = {
      ...createEmptyWorkspace(),
      moneySources: [
        { id: "cash", name: "Tunai", type: "cash" as const, balance: 100_000 },
        { id: "debt", name: "Hutang", type: "debt" as const, balance: 50_000 }
      ],
      savingGoals: [{ id: "goal", name: "Liburan", mode: "flexible" as const, target: 100_000, saved: 0, cycle: "monthly" as const }]
    };
    const transfer: Transaction = {
      id: "pay-debt",
      kind: "transfer",
      amount: 30_000,
      date: "2026-07-19",
      sourceId: "cash",
      destinationSourceId: "debt",
      note: "Bayar hutang",
      createdAt: "2026-07-19T00:00:00.000Z"
    };
    const paid = putTransaction(workspace, transfer);
    expect(paid.moneySources.map(({ balance }) => balance)).toEqual([70_000, 20_000]);

    const saved = moveGoalFunds(workspace, "goal", "deposit", 20_000, "cash", "2026-07-19");
    expect(saved.moneySources[0].balance).toBe(80_000);
    expect(saved.savingGoals[0].saved).toBe(20_000);
  });
});
