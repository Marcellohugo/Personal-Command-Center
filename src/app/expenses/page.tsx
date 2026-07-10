import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ExpenseCategoryChart } from "@/components/charts/expense-category-chart";
import { ExpenseForm } from "@/components/forms/expense-form";
import { createExpense, deleteExpense, updateExpense } from "@/lib/actions/expenses";
import { requireCurrentUser } from "@/lib/auth";
import { buildExpenseCategoryChart, calculateExpenseTotals } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function ExpensesPage() {
  const user = await requireCurrentUser();

  const expenses = await prisma.expense.findMany({
    where: {
      userId: user.id
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100
  });

  const totals = calculateExpenseTotals(expenses);
  const chartData = buildExpenseCategoryChart(expenses);

  return (
    <AppShell userName={user.name}>
      <div className="mx-auto grid max-w-7xl gap-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Modul pengeluaran</p>
          <h2 className="text-3xl font-black text-ink">Pengeluaran</h2>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="panel rounded-lg p-4">
            <p className="label">Hari ini</p>
            <p className="mt-2 text-2xl font-black">{formatCurrency(totals.today)}</p>
          </div>
          <div className="panel rounded-lg p-4">
            <p className="label">Minggu ini</p>
            <p className="mt-2 text-2xl font-black">{formatCurrency(totals.week)}</p>
          </div>
          <div className="panel rounded-lg p-4">
            <p className="label">Bulan ini</p>
            <p className="mt-2 text-2xl font-black">{formatCurrency(totals.month)}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="panel rounded-lg p-5">
            <h3 className="text-lg font-black text-ink">Tambah pengeluaran</h3>
            <div className="mt-4">
              <ExpenseForm action={createExpense} submitLabel="Tambah pengeluaran" />
            </div>
          </div>
          <div className="panel rounded-lg p-5">
            <h3 className="text-lg font-black text-ink">Grafik kategori</h3>
            <div className="mt-4">
              <ExpenseCategoryChart data={chartData} />
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {expenses.length > 0 ? (
            expenses.map((expense) => (
              <article key={expense.id} className="panel rounded-lg p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                      {expense.category} - {expense.source}
                    </p>
                    <h3 className="text-lg font-black text-ink">{formatCurrency(expense.amount)}</h3>
                  </div>
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={expense.id} />
                    <button className="button-danger" type="submit" title="Hapus pengeluaran">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Hapus
                    </button>
                  </form>
                </div>
                <ExpenseForm action={updateExpense} submitLabel="Simpan perubahan" defaultValues={expense} />
              </article>
            ))
          ) : (
            <p className="panel rounded-lg p-5 text-sm text-ink/60">Belum ada pengeluaran.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
