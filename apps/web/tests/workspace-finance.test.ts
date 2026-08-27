import { describe, expect, it } from "vitest";
import { createEmptyWorkspace, type Transaction } from "@/lib/offline-workspace";
import { advanceRecurringDate, applyReconciliation, moveGoalFunds, putTransaction, removeTransaction, runWorkspaceAutomation, setFinanceMonthLock } from "@/lib/workspace-finance";

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

  it("merekonsiliasi saldo dan menolak perubahan periode terkunci", () => {
    const workspace = { ...createEmptyWorkspace(), moneySources: [{ id: "cash", name: "Bank", type: "deposit_card" as const, balance: 100_000 }], transactions: [{ id: "cleared", kind: "expense" as const, amount: 5_000, date: "2026-08-20", sourceId: "cash", note: "Belanja", status: "cleared" as const, createdAt: "2026-08-20T00:00:00Z" }] };
    const reconciled = applyReconciliation(workspace, "cash", "2026-08-31", 110_000, "Mutasi bank");
    expect(reconciled.moneySources[0].balance).toBe(110_000);
    expect(reconciled.reconciliations[0].difference).toBe(10_000);
    expect(reconciled.transactions[0].status).toBe("reconciled");
    const locked = setFinanceMonthLock(reconciled, "2026-08", true);
    const unchanged = putTransaction(locked, { id: "late", kind: "expense", amount: 5_000, date: "2026-08-20", sourceId: "cash", note: "Terlambat", createdAt: "2026-08-20T00:00:00Z" });
    expect(unchanged.transactions).toHaveLength(1);
    const moved = putTransaction(locked, { ...locked.transactions[0], date: "2026-09-01" }, locked.transactions[0]);
    expect(moved.transactions[0].date).toBe("2026-08-20");
  });
});
