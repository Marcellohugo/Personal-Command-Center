import { CalendarDays, ClipboardCheck, FileText, WalletCards } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ExpenseCategoryChart } from "@/components/charts/expense-category-chart";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { buildDashboardMetrics, buildExpenseCategoryChart } from "@/lib/dashboard";
import { dayRange, monthRange } from "@/lib/date";
import { buildDailySummary } from "@/lib/summary";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const today = dayRange();
  const month = monthRange();

  const [todaySchedules, monthExpenses, habits, incompleteHabits] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        userId: user.id,
        date: today
      },
      orderBy: [{ startTime: "asc" }]
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        date: month
      },
      orderBy: [{ date: "desc" }]
    }),
    prisma.habit.findMany({
      where: {
        userId: user.id
      },
      include: {
        logs: {
          where: {
            completedAt: today
          }
        }
      },
      orderBy: [{ createdAt: "asc" }]
    }),
    prisma.habit.findMany({
      where: {
        userId: user.id,
        logs: {
          none: {
            completedAt: today
          }
        }
      }
    })
  ]);

  const dailySummary = buildDailySummary({
    schedules: todaySchedules,
    expenses: monthExpenses.filter((expense) => expense.date >= today.gte && expense.date <= today.lte),
    incompleteHabits
  });

  const metrics = buildDashboardMetrics({
    schedules: todaySchedules,
    expenses: monthExpenses,
    habits,
    dailySummary
  });

  const chartData = buildExpenseCategoryChart(monthExpenses);

  return (
    <AppShell userName={user.name}>
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Hari ini</p>
            <h2 className="text-3xl font-black text-ink">Dashboard utama</h2>
          </div>
          <p className="max-w-xl text-sm text-ink/60">{metrics.dailySummary}</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Jadwal hari ini"
            value={`${metrics.todayScheduleCount}`}
            detail="Agenda terurut berdasarkan jam"
            icon={CalendarDays}
          />
          <MetricCard
            label="Pengeluaran hari ini"
            value={formatCurrency(metrics.todayExpenseTotal)}
            detail="Dari transaksi manual dan WhatsApp"
            icon={WalletCards}
          />
          <MetricCard
            label="Pengeluaran bulan ini"
            value={formatCurrency(metrics.monthExpenseTotal)}
            detail="Akumulasi bulan berjalan"
            icon={FileText}
          />
          <MetricCard
            label="Habit belum selesai"
            value={`${metrics.incompleteHabitCount}`}
            detail="Checklist yang masih terbuka"
            icon={ClipboardCheck}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="panel rounded-lg p-5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-black text-ink">Jadwal hari ini</h3>
              <span className="rounded-md bg-moss/10 px-2 py-1 text-xs font-semibold text-moss">
                {todaySchedules.length} agenda
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {todaySchedules.length > 0 ? (
                todaySchedules.map((schedule) => (
                  <article key={schedule.id} className="rounded-lg border border-line bg-white p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-ink">{schedule.title}</p>
                        {schedule.description ? <p className="text-sm text-ink/60">{schedule.description}</p> : null}
                      </div>
                      <p className="text-sm font-semibold text-clay">
                        {schedule.startTime}
                        {schedule.endTime ? ` - ${schedule.endTime}` : ""}
                      </p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-line bg-white/60 p-4 text-sm text-ink/55">
                  Belum ada jadwal untuk hari ini.
                </p>
              )}
            </div>
          </div>

          <div className="panel rounded-lg p-5">
            <h3 className="text-lg font-black text-ink">Pengeluaran per kategori</h3>
            <div className="mt-4">
              <ExpenseCategoryChart data={chartData} />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
