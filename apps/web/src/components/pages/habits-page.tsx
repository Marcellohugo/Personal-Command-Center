import { CheckCircle2, Circle, Flame, Trash2, Trophy } from "lucide-react";
import { HabitHeatmap } from "@/components/charts/habit-heatmap";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { HabitForm } from "@/components/forms/habit-form";
import { createHabit, deleteHabit, toggleHabitCompletion } from "@/lib/actions/habits";
import { requireCurrentUser } from "@/lib/auth";
import { calculateBestStreak, calculateDailyStreak, isHabitCompleted } from "@/lib/habits";
import { prisma } from "@/lib/prisma";

export default async function HabitsPage() {
  const user = await requireCurrentUser();
  const now = new Date();

  const habits = await prisma.habit.findMany({
    where: {
      userId: user.id
    },
    include: {
      logs: {
        orderBy: {
          completedAt: "desc"
        }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  const content = (
      <div className="mx-auto grid max-w-7xl gap-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">Kebiasaan</p>
          <h2 className="text-3xl font-black text-ink dark:text-paper">Pelacak kebiasaan</h2>
        </header>

        <section id="tambah-habit" className="panel scroll-mt-32 rounded-lg p-5">
          <h3 className="text-lg font-black text-ink dark:text-paper">Tambah kebiasaan</h3>
          <div className="mt-4">
            <HabitForm action={createHabit} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {habits.length > 0 ? (
            habits.map((habit) => {
              const completed = isHabitCompleted(habit, now);
              const isDaily = habit.frequency === "daily";
              const streak = isDaily ? calculateDailyStreak(habit.logs, now) : 0;
              const bestStreak = isDaily ? calculateBestStreak(habit.logs) : 0;

              return (
                <article key={habit.id} className="panel rounded-lg p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50 dark:text-paper/40">
                        {habit.frequency === "daily" ? "Harian" : "Mingguan"}
                      </p>
                      <h3 className="mt-1 text-lg font-black text-ink dark:text-paper">{habit.name}</h3>
                      {isDaily ? (
                        <div className="mt-2 flex items-center gap-4">
                          <span className="flex items-center gap-1 text-sm text-ink/60 dark:text-paper/50">
                            <Flame className="h-3.5 w-3.5 text-clay" aria-hidden="true" />
                            Beruntun {streak} hari
                          </span>
                          <span className="flex items-center gap-1 text-sm text-ink/60 dark:text-paper/50">
                            <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                            Terbaik {bestStreak}
                          </span>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-ink/60 dark:text-paper/50">
                          {completed ? "Target minggu ini selesai" : "Target minggu ini belum selesai"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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
                          <span className="hidden sm:inline">
                            {completed
                              ? isDaily ? "Selesai" : "Selesai minggu ini"
                              : isDaily ? "Tandai" : "Tandai minggu ini"}
                          </span>
                        </button>
                      </form>
                      <form action={deleteHabit}>
                        <input type="hidden" name="habitId" value={habit.id} />
                        <ConfirmSubmitButton
                          className="button-danger px-3"
                          message={`Hapus kebiasaan “${habit.name}” beserta riwayatnya?`}
                          title="Hapus kebiasaan"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Hapus</span>
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                  <HabitHeatmap logs={habit.logs} weeksToShow={12} />
                </article>
              );
            })
          ) : (
            <p className="panel rounded-lg p-5 text-sm text-ink/60 dark:text-paper/50">Belum ada kebiasaan.</p>
          )}
        </section>
      </div>
  );

  return content;
}
