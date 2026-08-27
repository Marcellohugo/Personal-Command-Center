"use client";

import { useMemo, useState } from "react";
import { Award, Check, Circle, Flame, Goal, Plus, Sparkles, Target, Trophy } from "lucide-react";
import type { OfflineWorkspace } from "@/lib/offline-workspace";
import { areaSummaries, closeCycle, completeEvening, completeMorning, completeWeeklyReviewForXp, createCycle, currentStreak, dayKey, levelFromXp, todayCheckIn, todayPriorities, upsertPriority, upsertQuest, weekStart } from "@/lib/life-os";
import { cn } from "@/lib/utils";

type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
  onNavigate: (section: "agenda" | "transaksi" | "kebiasaan" | "perkembangan" | "proyek" | "pengaturan") => void;
};

const today = dayKey();

export function LifeOsPanel({ workspace, updateWorkspace, onNavigate }: Props) {
  const checkIn = todayCheckIn(workspace, today);
  const priorities = todayPriorities(workspace, today);
  const areas = useMemo(() => areaSummaries(workspace), [workspace]);
  const streak = currentStreak(workspace);
  const level = levelFromXp(workspace.gamification.totalXp);
  const [priorityText, setPriorityText] = useState("");
  const [energy, setEnergy] = useState(checkIn.energy ?? 3);
  const [win, setWin] = useState(checkIn.win ?? "");
  const [lesson, setLesson] = useState(checkIn.lesson ?? "");
  const [nextStep, setNextStep] = useState(checkIn.nextStep ?? "");
  const [questTitle, setQuestTitle] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewWorked, setReviewWorked] = useState("");
  const [reviewFocus, setReviewFocus] = useState("");
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(() => workspace.growthGoals.filter((goal) => goal.progress < 100).map((goal) => goal.id));

  function startCycle() {
    updateWorkspace((current) => ({ ...current, cycle: createCycle(today) }));
  }

  function finishCycle() {
    updateWorkspace((current) => closeCycle(current, selectedGoalIds));
    setSelectedGoalIds([]);
  }

  function addPriority() {
    const text = priorityText.trim();
    if (!text || priorities.length >= 3) return;
    updateWorkspace((current) => upsertPriority(current, { id: crypto.randomUUID(), date: today, text, done: false }));
    setPriorityText("");
  }

  function togglePriority(id: string) {
    updateWorkspace((current) => ({ ...current, priorities: current.priorities.map((item) => item.id === id ? { ...item, done: !item.done } : item) }));
  }

  function saveMorning() {
    updateWorkspace((current) => completeMorning(current, energy, today));
  }

  function saveEvening() {
    updateWorkspace((current) => completeEvening(current, { win: win.trim(), lesson: lesson.trim(), nextStep: nextStep.trim(), reflection: "" }, today));
  }

  function addQuest() {
    const title = questTitle.trim();
    if (!title) return;
    updateWorkspace((current) => upsertQuest(current, { id: crypto.randomUUID(), weekStart: weekStart(), title, done: false, createdAt: new Date().toISOString() }));
    setQuestTitle("");
  }

  function toggleQuest(id: string) {
    updateWorkspace((current) => ({ ...current, weeklyQuests: current.weeklyQuests.map((item) => item.id === id ? { ...item, done: !item.done } : item) }));
  }

  function saveReview() {
    if (!reviewSummary.trim() && !reviewWorked.trim() && !reviewFocus.trim()) return;
    updateWorkspace((current) => {
      const currentWeek = weekStart();
      const review = { id: `review-${currentWeek}`, weekStart: currentWeek, completedAt: new Date().toISOString(), summary: reviewSummary.trim(), whatWorked: reviewWorked.trim(), nextFocus: reviewFocus.trim() };
      const weeklyReviews = current.weeklyReviews.some((item) => item.weekStart === currentWeek) ? current.weeklyReviews.map((item) => item.weekStart === currentWeek ? review : item) : [review, ...current.weeklyReviews];
      return completeWeeklyReviewForXp({ ...current, weeklyReviews }, currentWeek);
    });
    setReviewSummary(""); setReviewWorked(""); setReviewFocus("");
  }

  return <section className="grid gap-4" aria-label="Marco Life OS">
    <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-5 text-white shadow-xl shadow-blue-900/20 sm:p-7">
      <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-100"><Sparkles className="h-4 w-4" /> Marco Life OS</p><h2 className="mt-3 max-w-2xl text-2xl font-black leading-tight sm:text-3xl">Hari ini cukup hadir, pilih tiga hal, lalu bergerak.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-blue-100">Satu dashboard untuk mencatat arah, aktivitas, dan bukti progres tanpa menghakimi.</p></div>
        <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-right backdrop-blur"><p className="text-xs font-bold uppercase tracking-wide text-blue-100">Level lifetime</p><p className="mt-1 text-4xl font-black">{level}</p><p className="text-xs font-bold text-blue-100">{workspace.gamification.totalXp} XP · {streak} hari beruntun</p></div>
      </div>
      {workspace.cycle.status === "setup" ? <div className="relative mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-4"><Goal className="h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-black">Siklus 12 minggu belum dimulai</p><p className="mt-1 text-xs text-blue-100">Mulai kosong, lalu tambahkan goal saat arah Anda semakin jelas.</p></div><button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-black text-blue-800" onClick={startCycle}>Mulai siklus</button></div> : <div className="relative mt-5 flex flex-wrap items-center gap-3 text-xs font-bold text-blue-100"><span>{workspace.cycle.name} · {workspace.cycle.startDate} sampai {workspace.cycle.endDate}</span><details className="rounded-lg border border-white/20 bg-white/10 px-3 py-2"><summary className="cursor-pointer font-black">Tutup & mulai siklus baru</summary><div className="mt-3 grid min-w-64 gap-2 text-blue-50">{workspace.growthGoals.filter((goal) => goal.cycleId === workspace.cycle.id && goal.progress < 100).map((goal) => <label className="flex items-start gap-2 text-xs" key={goal.id}><input type="checkbox" checked={selectedGoalIds.includes(goal.id)} onChange={(event) => setSelectedGoalIds((current) => event.target.checked ? [...current, goal.id] : current.filter((id) => id !== goal.id))} /><span>{goal.title}</span></label>)}<button type="button" className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-black text-blue-800" onClick={finishCycle}>Bekukan dan lanjut</button></div></details></div>}
    </article>

    <div className="grid gap-4 lg:grid-cols-2">
      <article className="panel rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Ritual pagi</p><h3 className="mt-1 text-xl font-black">Tentukan tenaga hari ini</h3></div><span className={cn("rounded-full px-2.5 py-1 text-xs font-black", checkIn.morningCompletedAt ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-blue-700")}>{checkIn.morningCompletedAt ? "Selesai" : "Belum"}</span></div><div className="mt-5 flex items-end gap-3"><label className="grid flex-1 gap-2"><span className="label">Energi</span><select className="field" value={energy} onChange={(event) => setEnergy(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label><button type="button" className="button-primary" onClick={saveMorning}><Check className="h-4 w-4" />Catat pagi</button></div></article>
      <article className="panel rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Ritual malam</p><h3 className="mt-1 text-xl font-black">Tutup hari dengan jernih</h3></div><span className={cn("rounded-full px-2.5 py-1 text-xs font-black", checkIn.eveningCompletedAt ? "bg-emerald-100 text-emerald-800" : "bg-blue-50 text-blue-700")}>{checkIn.eveningCompletedAt ? "Selesai" : "Belum"}</span></div><div className="mt-4 grid gap-2"><input className="field" value={win} onChange={(event) => setWin(event.target.value)} placeholder="Kemenangan hari ini" maxLength={500} /><input className="field" value={lesson} onChange={(event) => setLesson(event.target.value)} placeholder="Pelajaran yang dibawa" maxLength={500} /><div className="flex gap-2"><input className="field" value={nextStep} onChange={(event) => setNextStep(event.target.value)} placeholder="Langkah besok" maxLength={500} /><button type="button" className="button-primary shrink-0" onClick={saveEvening}><Check className="h-4 w-4" />Simpan</button></div></div></article>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
      <article className="panel rounded-2xl p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">Today</p><h3 className="mt-1 text-xl font-black">Tiga prioritas</h3></div><span className="text-xs font-bold text-ink/45 dark:text-paper/45">{priorities.filter((item) => item.done).length}/{priorities.length}</span></div><div className="mt-4 grid gap-2">{priorities.map((priority) => <button type="button" className="flex items-center gap-3 rounded-xl border border-line p-3 text-left transition hover:border-blue-400 dark:border-white/10" key={priority.id} onClick={() => togglePriority(priority.id)}>{priority.done ? <Check className="h-5 w-5 shrink-0 text-emerald-500" /> : <Circle className="h-5 w-5 shrink-0 text-blue-500" />}<span className={cn("text-sm font-bold", priority.done && "text-ink/40 line-through dark:text-paper/40")}>{priority.text}</span></button>)}{priorities.length < 3 ? <div className="flex gap-2"><input className="field" value={priorityText} onChange={(event) => setPriorityText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addPriority(); }} placeholder="Prioritas baru…" maxLength={240} /><button type="button" className="button-secondary shrink-0 px-3" onClick={addPriority} aria-label="Tambah prioritas"><Plus className="h-4 w-4" /></button></div> : null}{priorities.length === 0 ? <p className="text-sm text-ink/45 dark:text-paper/45">Tuliskan maksimal tiga hal paling penting.</p> : null}</div></article>

      <article className="panel rounded-2xl p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-600">Lima area hidup</p><h3 className="mt-1 text-xl font-black">Bukti yang terkumpul</h3></div><Target className="h-5 w-5 text-cyan-600" /></div><div className="mt-4 grid gap-3">{areas.map((area) => <button type="button" key={area.area} className="grid gap-1 text-left" onClick={() => onNavigate(area.area === "finance" ? "transaksi" : area.area === "career" ? "proyek" : "perkembangan")}><div className="flex items-center justify-between gap-2 text-xs font-bold"><span>{area.label}</span><span className="text-blue-600">{area.progress}% · {area.evidence} bukti</span></div><div className="h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${area.progress}%` }} /></div></button>)}</div></article>

      <article className="panel rounded-2xl p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">Quest minggu ini</p><h3 className="mt-1 text-xl font-black">Maksimal tiga</h3></div><Trophy className="h-5 w-5 text-amber-500" /></div><div className="mt-4 grid gap-2">{workspace.weeklyQuests.filter((item) => item.weekStart === weekStart()).map((quest) => <button type="button" className="flex items-center gap-3 rounded-xl border border-line p-3 text-left dark:border-white/10" key={quest.id} onClick={() => toggleQuest(quest.id)}>{quest.done ? <Check className="h-5 w-5 shrink-0 text-amber-500" /> : <Circle className="h-5 w-5 shrink-0 text-amber-500" />}<span className={cn("text-sm font-bold", quest.done && "line-through opacity-50")}>{quest.title}</span></button>)}{workspace.weeklyQuests.filter((item) => item.weekStart === weekStart()).length < 3 ? <div className="flex gap-2"><input className="field" value={questTitle} onChange={(event) => setQuestTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addQuest(); }} placeholder="Quest manual…" maxLength={240} /><button type="button" className="button-secondary shrink-0 px-3" onClick={addQuest} aria-label="Tambah quest"><Plus className="h-4 w-4" /></button></div> : null}<p className="text-xs leading-5 text-ink/45 dark:text-paper/45">Quest tidak menghasilkan XP; ia membantu Anda melihat arah minggu ini.</p></div></article>
    </div>

    <article className="panel rounded-2xl p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">Review mingguan · 5 menit</p><h3 className="mt-1 text-xl font-black">Apa yang ingin dibawa ke minggu berikutnya?</h3></div><button type="button" className="button-secondary" onClick={() => onNavigate("perkembangan")}><Award className="h-4 w-4" />Lihat perkembangan</button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><textarea className="field min-h-24 resize-y" value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} placeholder="Ringkasan minggu ini" maxLength={1000} /><textarea className="field min-h-24 resize-y" value={reviewWorked} onChange={(event) => setReviewWorked(event.target.value)} placeholder="Yang berjalan baik" maxLength={1000} /><div className="grid gap-2"><textarea className="field min-h-24 resize-y" value={reviewFocus} onChange={(event) => setReviewFocus(event.target.value)} placeholder="Fokus berikutnya" maxLength={1000} /><button type="button" className="button-primary" onClick={saveReview}>Simpan review · +30 XP</button></div></div></article>
    <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"><Flame className="h-4 w-4" />Streak aktif dari ritual pagi atau malam. Selesaikan keduanya untuk mendapatkan Perfect Day.</div>
  </section>;
}
