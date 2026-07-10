import { CheckCircle2, Circle } from "lucide-react";
import { subDays } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { HabitForm } from "@/components/forms/habit-form";
import { createHabit, toggleHabitCompletion } from "@/lib/actions/habits";
import { requireCurrentUser } from "@/lib/auth";
import { calculateDailyStreak, isCompletedToday } from "@/lib/habits";
import { prisma } from "@/lib/prisma";

export default async function HabitsPage() {
  const user = await requireCurrentUser();

  const habits = await prisma.habit.findMany({
    where: {
      userId: user.id
    },
    include: {
      logs: {
        where: {
          completedAt: {
            gte: subDays(new Date(), 60)
          }
        },
        orderBy: {
          completedAt: "desc"
        }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  return (
    <AppShell userName={user.name}>
      <div className="mx-auto grid max-w-7xl gap-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Modul habit</p>
          <h2 className="text-3xl font-black text-ink">Habit tracker</h2>
        </header>

        <section className="panel rounded-lg p-5">
          <h3 className="text-lg font-black text-ink">Tambah habit</h3>
          <div className="mt-4">
            <HabitForm action={createHabit} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {habits.length > 0 ? (
            habits.map((habit) => {
              const completed = isCompletedToday(habit.logs);
              const streak = calculateDailyStreak(habit.logs);

              return (
                <article key={habit.id} className="panel rounded-lg p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{habit.frequency}</p>
                      <h3 className="mt-1 text-lg font-black text-ink">{habit.name}</h3>
                      <p className="mt-2 text-sm text-ink/60">Streak {streak} hari</p>
                    </div>
                    <form action={toggleHabitCompletion}>
                      <input type="hidden" name="habitId" value={habit.id} />
                      <button
                        type="submit"
                        className={completed ? "button-primary" : "button-secondary"}
                        title={completed ? "Tandai belum selesai" : "Tandai selesai"}
                      >
                        {completed ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Circle className="h-4 w-4" aria-hidden="true" />
                        )}
                        {completed ? "Selesai" : "Checklist"}
                      </button>
                    </form>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="panel rounded-lg p-5 text-sm text-ink/60">Belum ada habit.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
