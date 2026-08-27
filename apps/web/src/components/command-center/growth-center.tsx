"use client";

import { Brain, CheckCircle2, Pencil, Plus, Sparkles, Target, Timer, Trash2, Trophy } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { growthMetrics } from "@/lib/growth";
import {
  growthAreas,
  removeById,
  upsertById,
  type DailyReview,
  type FocusSession,
  type GrowthGoal,
  type OfflineWorkspace
} from "@/lib/offline-workspace";

type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
};

type FormKind = "goal" | "focus" | "review";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function areaLabel(value: string) {
  return growthAreas.find((area) => area.value === value)?.label ?? "Pribadi";
}

function Field({ label, name, defaultValue, ...props }: { label: string; name: string; defaultValue?: string | number; [key: string]: unknown }) {
  return <label className="grid gap-2"><span className="label">{label}</span><input className="field" name={name} defaultValue={defaultValue} {...props} /></label>;
}

export function GrowthCenter({ workspace, updateWorkspace }: Props) {
  const [form, setForm] = useState<FormKind | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const metrics = useMemo(
    () => growthMetrics(workspace.growthGoals, workspace.focusSessions, workspace.dailyReviews),
    [workspace.dailyReviews, workspace.focusSessions, workspace.growthGoals]
  );
  const editingGoal = workspace.growthGoals.find(({ id }) => id === editingGoalId);
  const recentSessions = [...workspace.focusSessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const recentReviews = [...workspace.dailyReviews].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const nextActions = workspace.growthGoals.filter(({ progress, nextAction }) => progress < 100 && nextAction).sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999")).slice(0, 5);
  const metricCards = [
    { label: "Tujuan aktif", value: metrics.activeGoals, icon: Target },
    { label: "Progres rata-rata", value: `${metrics.averageProgress}%`, icon: Sparkles },
    { label: "Fokus 7 hari", value: `${metrics.weeklyMinutes} mnt`, icon: Timer },
    { label: "Streak refleksi", value: `${metrics.reviewStreak} hari`, icon: Brain },
    { label: "Mood 7 hari", value: metrics.averageMood ? `${metrics.averageMood}/5` : "—", icon: CheckCircle2 }
  ];

  function open(kind: FormKind, goalId: string | null = null) {
    setForm(kind);
    setEditingGoalId(goalId);
  }

  function close() {
    setForm(null);
    setEditingGoalId(null);
  }

  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const goal: GrowthGoal = {
      id: editingGoal?.id ?? crypto.randomUUID(),
      title: String(data.get("title") || "").trim(),
      area: data.get("area") as GrowthGoal["area"],
      progress: Math.max(0, Math.min(100, Number(data.get("progress")) || 0)),
      targetDate: String(data.get("targetDate") || ""),
      nextAction: String(data.get("nextAction") || "").trim(),
      createdAt: editingGoal?.createdAt ?? new Date().toISOString(),
      cycleId: editingGoal?.cycleId ?? workspace.cycle.id
    };
    if (!goal.title) return;
    updateWorkspace((current) => ({ ...current, growthGoals: upsertById(current.growthGoals, goal) }));
    close();
  }

  function saveFocus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const session: FocusSession = {
      id: crypto.randomUUID(),
      title: String(data.get("title") || "").trim(),
      area: data.get("area") as FocusSession["area"],
      minutes: Math.max(1, Math.min(1440, Number(data.get("minutes")) || 0)),
      date: String(data.get("date") || today()),
      note: String(data.get("note") || "").trim()
    };
    if (!session.title || !Number(data.get("minutes"))) return;
    updateWorkspace((current) => ({ ...current, focusSessions: [session, ...current.focusSessions] }));
    close();
  }

  function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date") || today());
    const existing = workspace.dailyReviews.find((item) => item.date.slice(0, 10) === date);
    const review: DailyReview = {
      id: existing?.id ?? crypto.randomUUID(),
      date,
      mood: Number(data.get("mood")) || 3,
      energy: Number(data.get("energy")) || 3,
      win: String(data.get("win") || "").trim(),
      lesson: String(data.get("lesson") || "").trim(),
      nextStep: String(data.get("nextStep") || "").trim()
    };
    updateWorkspace((current) => ({ ...current, dailyReviews: upsertById(current.dailyReviews, review) }));
    close();
  }

  function moveProgress(goal: GrowthGoal, delta: number) {
    updateWorkspace((current) => ({
      ...current,
      growthGoals: current.growthGoals.map((item) => item.id === goal.id ? { ...item, progress: Math.max(0, Math.min(100, item.progress + delta)) } : item)
    }));
  }

  function remove(kind: "goal" | "focus" | "review", id: string, title: string) {
    if (!confirm(`Hapus “${title}”?`)) return;
    updateWorkspace((current) => ({
      ...current,
      growthGoals: kind === "goal" ? removeById(current.growthGoals, id) : current.growthGoals,
      focusSessions: kind === "focus" ? removeById(current.focusSessions, id) : current.focusSessions,
      dailyReviews: kind === "review" ? removeById(current.dailyReviews, id) : current.dailyReviews
    }));
  }

  return <section className="grid gap-5">
    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-950 p-6 text-white shadow-panel sm:p-8">
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Pusat perkembangan</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Tumbuh dengan bukti, bukan sekadar niat.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Tetapkan tujuan, catat waktu fokus, refleksikan pelajaran, lalu lihat momentum Anda terbentuk.</p></div>
        <div className="grid h-32 w-32 place-items-center rounded-full border-[10px] border-white/20 bg-white/10"><div className="text-center"><strong className="text-4xl font-black">{metrics.growthScore}</strong><span className="block text-xs font-bold text-blue-100">SKOR TUMBUH</span></div></div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2"><button type="button" className="rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-800" onClick={() => open("goal")}><Plus className="mr-2 inline h-4 w-4" />Tujuan</button><button type="button" className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-black hover:bg-white/25" onClick={() => open("focus")}><Timer className="mr-2 inline h-4 w-4" />Catat fokus</button><button type="button" className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-black hover:bg-white/25" onClick={() => open("review")}><Brain className="mr-2 inline h-4 w-4" />Refleksi hari ini</button></div>
    </div>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {metricCards.map(({ label, value, icon: Icon }) => <article className="panel rounded-xl p-4" key={label}><Icon className="h-5 w-5 text-blue-600" /><p className="mt-4 text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">{label}</p><p className="mt-1 text-xl font-black">{value}</p></article>)}
    </div>

    {form ? <div className="panel rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-black">{form === "goal" ? editingGoal ? "Ubah tujuan" : "Tujuan perkembangan baru" : form === "focus" ? "Catat sesi fokus" : "Refleksi harian"}</h3><button type="button" className="button-secondary" onClick={close}>Tutup</button></div>
      {form === "goal" ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveGoal} key={editingGoal?.id ?? "new-growth-goal"}><Field label="Tujuan" name="title" defaultValue={editingGoal?.title} placeholder="Contoh: Mahir presentasi" maxLength={160} required /><label className="grid gap-2"><span className="label">Area</span><select className="field" name="area" defaultValue={editingGoal?.area ?? "learning"}>{growthAreas.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}</select></label><Field label="Progres (%)" name="progress" type="number" min={0} max={100} defaultValue={editingGoal?.progress ?? 0} required /><Field label="Target tanggal" name="targetDate" type="date" defaultValue={editingGoal?.targetDate} required={false} /><div className="sm:col-span-2"><Field label="Langkah berikutnya" name="nextAction" defaultValue={editingGoal?.nextAction} placeholder="Tindakan terkecil yang bisa dilakukan" maxLength={240} required={false} /></div><div className="sm:col-span-2"><button className="button-primary" type="submit">Simpan tujuan</button></div></form> : null}
      {form === "focus" ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveFocus}><Field label="Aktivitas" name="title" placeholder="Belajar, latihan, deep work…" maxLength={160} required /><label className="grid gap-2"><span className="label">Area</span><select className="field" name="area" defaultValue="learning">{growthAreas.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}</select></label><Field label="Durasi (menit)" name="minutes" type="number" min={1} max={1440} defaultValue={30} required /><Field label="Tanggal" name="date" type="date" defaultValue={today()} required /><div className="sm:col-span-2"><Field label="Catatan hasil" name="note" placeholder="Apa yang selesai atau dipelajari?" maxLength={1000} required={false} /></div><div className="sm:col-span-2"><button className="button-primary" type="submit">Simpan sesi</button></div></form> : null}
      {form === "review" ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveReview}><Field label="Tanggal" name="date" type="date" defaultValue={today()} required /><label className="grid gap-2"><span className="label">Mood</span><select className="field" name="mood" defaultValue="4">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label><label className="grid gap-2"><span className="label">Energi</span><select className="field" name="energy" defaultValue="4">{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label><Field label="Kemenangan hari ini" name="win" placeholder="Hal baik yang berhasil dilakukan" maxLength={1000} required={false} /><Field label="Pelajaran" name="lesson" placeholder="Apa yang dipahami hari ini?" maxLength={1000} required={false} /><Field label="Langkah besok" name="nextStep" placeholder="Satu tindakan paling penting" maxLength={1000} required={false} /><div className="sm:col-span-2"><button className="button-primary" type="submit">Simpan refleksi</button></div></form> : null}
    </div> : null}

    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-3"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Tujuan perkembangan</p><h3 className="mt-1 text-xl font-black">Arah yang sedang dikejar</h3></div><button type="button" className="button-secondary" onClick={() => open("goal")}><Plus className="h-4 w-4" />Tambah</button></div>{workspace.growthGoals.length ? workspace.growthGoals.map((goal) => <article className="panel rounded-xl p-5" key={goal.id}><div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">{areaLabel(goal.area)}</span><h4 className="mt-3 text-lg font-black">{goal.title}</h4><p className="mt-1 text-sm text-ink/50 dark:text-paper/50">{goal.targetDate ? `Target ${goal.targetDate}` : "Tanpa tenggat"}</p></div><div className="flex gap-1"><button type="button" className="button-secondary h-9 w-9 justify-center p-0" onClick={() => open("goal", goal.id)} aria-label={`Ubah ${goal.title}`}><Pencil className="h-4 w-4" /></button><button type="button" className="button-secondary h-9 w-9 justify-center p-0 text-red-700" onClick={() => remove("goal", goal.id, goal.title)} aria-label={`Hapus ${goal.title}`}><Trash2 className="h-4 w-4" /></button></div></div><div className="mt-5 h-2.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600" style={{ width: `${goal.progress}%` }} /></div><div className="mt-2 flex items-center justify-between text-xs font-bold"><span>{goal.progress >= 100 ? "Selesai" : goal.nextAction || "Tentukan langkah berikutnya"}</span><span className="text-blue-600">{goal.progress}%</span></div><div className="mt-4 flex gap-2"><button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => moveProgress(goal, -10)} disabled={goal.progress === 0}>−10%</button><button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => moveProgress(goal, 10)} disabled={goal.progress === 100}>+10%</button><button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => moveProgress(goal, 100 - goal.progress)} disabled={goal.progress === 100}>Tandai selesai</button></div></article>) : <div className="panel rounded-xl p-8 text-center text-sm text-ink/50 dark:text-paper/50">Belum ada tujuan perkembangan.</div>}</div>

      <div className="grid content-start gap-4"><article className="panel rounded-xl p-5"><div className="flex items-center gap-3"><Target className="h-5 w-5 text-blue-600" /><h3 className="font-black">Langkah berikutnya</h3></div><div className="mt-4 grid gap-2">{nextActions.map((goal) => <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30" key={goal.id}><p className="text-sm font-bold">{goal.nextAction}</p><p className="mt-1 text-xs text-ink/45 dark:text-paper/45">{goal.title}</p></div>)}{nextActions.length === 0 ? <p className="text-sm text-ink/50 dark:text-paper/50">Tambahkan langkah kecil pada tujuan aktif.</p> : null}</div></article><article className="panel rounded-xl p-5"><div className="flex items-center gap-3"><Trophy className="h-5 w-5 text-amber-500" /><h3 className="font-black">Pencapaian</h3></div><div className="mt-4 flex flex-wrap gap-2">{metrics.achievements.map((item) => <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" key={item}>{item}</span>)}{metrics.achievements.length === 0 ? <p className="text-sm text-ink/50 dark:text-paper/50">Mulai satu tujuan untuk membuka pencapaian pertama.</p> : null}</div></article></div>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <article className="panel rounded-xl p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Log aktivitas</p><h3 className="mt-1 text-lg font-black">Fokus dan belajar</h3></div><button type="button" className="button-secondary" onClick={() => open("focus")}><Plus className="h-4 w-4" />Catat</button></div><div className="mt-4 grid gap-2">{recentSessions.map((session) => <div className="flex items-start gap-3 rounded-lg border border-line p-3 dark:border-white/10" key={session.id}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700"><Timer className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-bold">{session.title}</p><p className="mt-1 text-xs text-ink/45 dark:text-paper/45">{areaLabel(session.area)} · {session.minutes} menit · {session.date.slice(0, 10)}</p>{session.note ? <p className="mt-2 text-sm text-ink/65 dark:text-paper/65">{session.note}</p> : null}</div><button type="button" onClick={() => remove("focus", session.id, session.title)} aria-label={`Hapus ${session.title}`}><Trash2 className="h-4 w-4 text-red-600" /></button></div>)}{recentSessions.length === 0 ? <p className="text-sm text-ink/50 dark:text-paper/50">Belum ada sesi fokus.</p> : null}</div></article>
      <article className="panel rounded-xl p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Jurnal progres</p><h3 className="mt-1 text-lg font-black">Refleksi terbaru</h3></div><button type="button" className="button-secondary" onClick={() => open("review")}><Plus className="h-4 w-4" />Refleksi</button></div><div className="mt-4 grid gap-2">{recentReviews.map((review) => <div className="rounded-lg border border-line p-3 dark:border-white/10" key={review.id}><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-indigo-600">{review.date.slice(0, 10)} · Mood {review.mood}/5 · Energi {review.energy}/5</p><button type="button" onClick={() => remove("review", review.id, `refleksi ${review.date.slice(0, 10)}`)} aria-label="Hapus refleksi"><Trash2 className="h-4 w-4 text-red-600" /></button></div>{review.win ? <p className="mt-2 text-sm"><strong>Menang:</strong> {review.win}</p> : null}{review.lesson ? <p className="mt-1 text-sm"><strong>Pelajaran:</strong> {review.lesson}</p> : null}{review.nextStep ? <p className="mt-1 text-sm"><strong>Berikutnya:</strong> {review.nextStep}</p> : null}</div>)}{recentReviews.length === 0 ? <p className="text-sm text-ink/50 dark:text-paper/50">Belum ada refleksi.</p> : null}</div></article>
    </div>
  </section>;
}
