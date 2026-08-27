import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "@/lib/offline-workspace";
import { budgetReport, cashFlowForecast, debtProjection, exportTransactionsCsv, financeReport, importTransactionsCsv, investmentSummary, yearlyFinanceReport } from "@/lib/finance-insights";

describe("finance insights", () => {
  it("menghitung laporan periode, budget, forecast, dan investasi", () => {
    const workspace = createEmptyWorkspace();
    workspace.moneySources = [{ id: "cash", name: "Bank", type: "deposit_card", balance: 1_000_000 }];
    workspace.categoryGroups = [{ id: "food", name: "Makan", kind: "expense", monthlyBudget: 400_000 }];
    workspace.transactions = [
      { id: "income", kind: "income", amount: 2_000_000, date: "2026-08-01", sourceId: "cash", note: "Gaji", createdAt: "2026-08-01T00:00:00Z" },
      { id: "expense", kind: "expense", amount: 250_000, date: "2026-08-02", sourceId: "cash", categoryId: "food", note: "Belanja", createdAt: "2026-08-02T00:00:00Z" }
    ];
    workspace.recurringItems = [{ id: "bill", name: "Internet", kind: "payment", amount: 100_000, frequency: "monthly", nextDate: "2026-08-10", sourceId: "cash", destination: "ISP" }];
    workspace.investments = [{ id: "fund", name: "Reksa dana", kind: "fund", units: 10, costBasis: 10_000, currentPrice: 12_000, dividends: 2_000, updatedAt: "2026-08-01T00:00:00Z" }];

    expect(financeReport(workspace, "2026-08")).toMatchObject({ income: 2_000_000, expense: 250_000, net: 1_750_000 });
    expect(yearlyFinanceReport(workspace, "2026")).toMatchObject({ income: 2_000_000, expense: 250_000, net: 1_750_000 });
    expect(budgetReport(workspace, "2026-08").rows[0]).toMatchObject({ limit: 400_000, remaining: 150_000 });
    expect(cashFlowForecast(workspace, "2026-08-01", 15).find(({ date }) => date === "2026-08-10")?.balance).toBe(900_000);
    expect(investmentSummary(workspace.investments)).toMatchObject({ cost: 100_000, value: 120_000, gain: 22_000 });
  });

  it("membuat proyeksi utang dan impor CSV tanpa duplikat", () => {
    const projection = debtProjection({ id: "debt", name: "Kredit", type: "debt", balance: 1_000_000, annualInterestRate: 12, minimumPayment: 100_000 });
    expect(projection.payoffMonths).toBeGreaterThan(10);
    expect(projection.schedule.at(-1)?.balance).toBe(0);

    const workspace = createEmptyWorkspace();
    workspace.moneySources = [{ id: "cash", name: "Bank", type: "deposit_card", balance: 0 }];
    const csv = "tanggal,jenis,nominal,sumber,catatan\r\n2026-08-01,pemasukan,500000,Bank,Honor";
    const imported = importTransactionsCsv(csv, workspace);
    expect(imported.errors).toEqual([]);
    expect(imported.transactions[0]).toMatchObject({ kind: "income", amount: 500_000, sourceId: "cash" });
    expect(exportTransactionsCsv(workspace, imported.transactions)).toContain("Honor");
    const bankCsv = "tanggal;jenis;nominal;sumber;catatan\r\n27/08/2026;pengeluaran;Rp 1.250.000,00;Bank;Belanja";
    expect(importTransactionsCsv(bankCsv, workspace).transactions[0]).toMatchObject({ date: "2026-08-27", kind: "expense", amount: 1_250_000 });
  });
});
