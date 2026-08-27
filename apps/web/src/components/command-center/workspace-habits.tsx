"use client";

import { CheckCircle2, Circle, Flame, Pencil, Plus, Trash2, Trophy, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { HabitHeatmap } from "@/components/charts/habit-heatmap";
import { removeById, upsertById, type OfflineWorkspace, type WorkspaceHabit } from "@/lib/offline-workspace";
import { completeHabitForXp } from "@/lib/life-os";

type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
};

function dateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function startOfWeek(value = new Date()) {
  const result = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function completedNow(habit: WorkspaceHabit) {
  if (habit.frequency === "daily") return habit.completedDates.includes(dateKey());
  const from = dateKey(startOfWeek());
  const to = new Date(startOfWeek());
  to.setDate(to.getDate() + 6);
  return habit.completedDates.some((value) => value >= from && value <= dateKey(to));
}

function streaks(habit: WorkspaceHabit) {
  const days = new Set(habit.completedDates);
  let current = 0;
  const cursor = new Date();
  while (days.has(dateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  const sorted = [...days].sort();
  let best = sorted.length ? 1 : 0;
  let run = best;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T12:00:00`);
    const next = new Date(`${sorted[index]}T12:00:00`);
    run = Math.round((next.getTime() - previous.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best };
}

export function WorkspaceHabits({ workspace, updateWorkspace }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const editing = workspace.habits.find(({ id }) => id === editingId);

  function closeForm() {
    setEditingId(null);
    setShowForm(false);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const habit: WorkspaceHabit = {
      id: editing?.id ?? crypto.randomUUID(),
      name: String(data.get("name") || "").trim(),
      frequency: data.get("frequency") === "weekly" ? "weekly" : "daily",
      completedDates: editing?.completedDates ?? [],
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      linkedGrowthGoalId: String(data.get("linkedGrowthGoalId") || editing?.linkedGrowthGoalId || "") || undefined
    };
    if (!habit.name) return;
    updateWorkspace((current) => ({ ...current, habits: upsertById(current.habits, habit) }));
    closeForm();
  }

  function toggle(habit: WorkspaceHabit) {
    updateWorkspace((current) => {
      let completedAfter = false;
      const next = {
      ...current,
      habits: current.habits.map((item) => {
        if (item.id !== habit.id) return item;
        const dates = new Set(item.completedDates);
        if (item.frequency === "daily") {
          const today = dateKey();
          if (!dates.delete(today)) dates.add(today);
        } else {
          const from = dateKey(startOfWeek());
          const toDate = new Date(startOfWeek());
          toDate.setDate(toDate.getDate() + 6);
          const to = dateKey(toDate);
          const currentWeek = [...dates].filter((value) => value >= from && value <= to);
          if (currentWeek.length) currentWeek.forEach((value) => dates.delete(value));
          else dates.add(dateKey());
        }
        completedAfter = item.frequency === "weekly" ? [...dates].some((value) => value >= dateKey(startOfWeek()) && value <= dateKey(new Date(startOfWeek().getFullYear(), startOfWeek().getMonth(), startOfWeek().getDate() + 6))) : dates.has(dateKey());
        return { ...item, completedDates: [...dates].sort() };
      })
      };
      return completedAfter ? completeHabitForXp(next, habit.id) : next;
    });
  }

  function remove(habit: WorkspaceHabit) {
    if (!confirm(`Hapus kebiasaan “${habit.name}” beserta riwayatnya?`)) return;
    updateWorkspace((current) => ({ ...current, habits: removeById(current.habits, habit.id) }));
  }

  return <section className="grid gap-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">Ritme pribadi</p><h2 className="text-3xl font-black">Kebiasaan</h2></div><button className="button-primary" type="button" onClick={() => { setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />Tambah kebiasaan</button></header>
    {showForm ? <form className="panel grid gap-4 rounded-xl p-5 sm:grid-cols-2" onSubmit={save} key={editing?.id ?? "new-habit"}><div className="flex items-center justify-between sm:col-span-2"><h3 className="font-black">{editing ? "Ubah kebiasaan" : "Kebiasaan baru"}</h3><button className="button-secondary px-2.5" type="button" onClick={closeForm} aria-label="Tutup"><X className="h-4 w-4" /></button></div><label className="grid gap-2"><span className="label">Nama</span><input className="field" name="name" defaultValue={editing?.name} required maxLength={100} /></label><label className="grid gap-2"><span className="label">Frekuensi</span><select className="field" name="frequency" defaultValue={editing?.frequency ?? "daily"}><option value="daily">Harian</option><option value="weekly">Mingguan</option></select></label><label className="grid gap-2 sm:col-span-2"><span className="label">Hubungkan ke goal (opsional)</span><select className="field" name="linkedGrowthGoalId" defaultValue={editing?.linkedGrowthGoalId ?? ""}><option value="">Tanpa goal</option>{workspace.growthGoals.map((goal) => <option value={goal.id} key={goal.id}>{goal.title}</option>)}</select></label><button className="button-primary w-fit" type="submit">{editing ? "Simpan perubahan" : "Tambahkan"}</button></form> : null}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {workspace.habits.map((habit) => {
        const completed = completedNow(habit);
        const streak = streaks(habit);
        const logs = habit.completedDates.map((completedAt) => ({ completedAt: new Date(`${completedAt}T12:00:00`) }));
        return <article className="panel rounded-xl p-5" key={habit.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">{habit.frequency === "daily" ? "Harian" : "Mingguan"}</p><h3 className="mt-1 text-lg font-black">{habit.name}</h3></div><div className="flex gap-1"><button className="button-secondary px-2.5" type="button" onClick={() => { setEditingId(habit.id); setShowForm(true); }} aria-label="Ubah kebiasaan"><Pencil className="h-4 w-4" /></button><button className="button-danger px-2.5" type="button" onClick={() => remove(habit)} aria-label="Hapus kebiasaan"><Trash2 className="h-4 w-4" /></button></div></div>{habit.frequency === "daily" ? <div className="mt-3 flex gap-4 text-sm text-ink/55 dark:text-paper/50"><span className="flex items-center gap-1"><Flame className="h-4 w-4 text-clay" />Beruntun {streak.current}</span><span className="flex items-center gap-1"><Trophy className="h-4 w-4 text-amber-500" />Terbaik {streak.best}</span></div> : <p className="mt-3 text-sm text-ink/55 dark:text-paper/50">{completed ? "Target minggu ini selesai" : "Target minggu ini belum selesai"}</p>}<HabitHeatmap logs={logs} weeksToShow={12} /><button className={completed ? "button-primary mt-4" : "button-secondary mt-4"} type="button" onClick={() => toggle(habit)}>{completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}{completed ? "Selesai" : "Tandai selesai"}</button></article>;
      })}
      {workspace.habits.length === 0 ? <div className="panel grid min-h-52 place-items-center rounded-xl p-6 text-center text-sm text-ink/55 dark:text-paper/50">Belum ada kebiasaan.</div> : null}
    </div>
  </section>;
}
