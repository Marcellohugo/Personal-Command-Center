import { formatCurrency } from "@/lib/utils";

type SummaryInput = {
  schedules: Array<{ title: string; startTime: string }>;
  expenses: Array<{ amount: number; note: string | null; category: string }>;
  incompleteHabits: Array<{ name: string }>;
};

export function buildDailySummary(input: SummaryInput) {
  const scheduleText =
    input.schedules.length > 0
      ? `${input.schedules.length} jadwal: ${input.schedules
          .map((schedule) => `${schedule.startTime} ${schedule.title}`)
          .join(", ")}`
      : "Tidak ada jadwal hari ini";

  const expenseTotal = input.expenses.reduce((total, expense) => total + expense.amount, 0);
  const expenseText =
    input.expenses.length > 0
      ? `pengeluaran ${formatCurrency(expenseTotal)} dari ${input.expenses.length} transaksi`
      : "belum ada pengeluaran";

  const habitText =
    input.incompleteHabits.length > 0
      ? `${input.incompleteHabits.length} habit belum selesai`
      : "semua habit harian selesai";

  return `${scheduleText}; ${expenseText}; ${habitText}.`;
}
