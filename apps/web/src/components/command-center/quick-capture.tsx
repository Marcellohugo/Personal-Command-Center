"use client";

import { CalendarDays, ClipboardCheck, NotebookPen, PanelsTopLeft, Plus, ReceiptText, Target, Timer, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { growthAreas, type OfflineWorkspace, type ProjectBoard } from "@/lib/offline-workspace";

type CaptureKind = "transaction" | "schedule" | "ticket" | "note" | "habit" | "focus" | "goal";
type Props = { workspace: OfflineWorkspace; updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void };

const choices = [
  { id: "transaction" as const, label: "Transaksi", icon: ReceiptText, tone: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-300" },
  { id: "schedule" as const, label: "Agenda", icon: CalendarDays, tone: "bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-400/15 dark:text-violet-300" },
  { id: "ticket" as const, label: "Ticket", icon: PanelsTopLeft, tone: "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-400/15 dark:text-amber-300" },
  { id: "note" as const, label: "Note", icon: NotebookPen, tone: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-400/15 dark:text-indigo-300" },
  { id: "habit" as const, label: "Habit", icon: ClipboardCheck, tone: "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-400/15 dark:text-rose-300" },
  { id: "focus" as const, label: "Fokus", icon: Timer, tone: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-400/15 dark:text-cyan-300" },
  { id: "goal" as const, label: "Goal", icon: Target, tone: "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200 dark:bg-fuchsia-400/15 dark:text-fuchsia-300" }
];

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function QuickCapture({ workspace, updateWorkspace }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CaptureKind>("note");

  function close() { setOpen(false); }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    updateWorkspace((current) => {
      if (kind === "transaction") return { ...current, transactions: [{ id, kind: data.get("transactionKind") === "income" ? "income" : "expense", amount: Math.max(1, Number(data.get("amount")) || 0), date: String(data.get("date") || today()), sourceId: String(data.get("sourceId") || ""), note: title, createdAt: now }, ...current.transactions] };
      if (kind === "schedule") return { ...current, schedules: [{ id, title, description: "", date: String(data.get("date") || today()), startTime: String(data.get("startTime") || "09:00"), status: "planned", recurrence: "none", source: "manual" }, ...current.schedules] };
      if (kind === "note") return { ...current, notes: [{ id, title, content: String(data.get("content") || "").trim(), pinned: false, updatedAt: now, folder: "", tags: [] }, ...current.notes] };
      if (kind === "habit") return { ...current, habits: [{ id, name: title, frequency: data.get("frequency") === "weekly" ? "weekly" : "daily", completedDates: [], createdAt: now }, ...current.habits] };
      if (kind === "focus") return { ...current, focusSessions: [{ id, title, area: String(data.get("area") || "personal") as "career" | "learning" | "health" | "finance" | "personal", minutes: Math.max(1, Math.min(1440, Number(data.get("minutes")) || 25)), date: String(data.get("date") || today()), note: "", linkedGrowthGoalId: String(data.get("linkedGrowthGoalId") || "") || undefined }, ...current.focusSessions] };
      if (kind === "goal") return { ...current, growthGoals: [{ id, title, area: String(data.get("area") || "personal") as "career" | "learning" | "health" | "finance" | "personal", progress: 0, targetDate: "", nextAction: String(data.get("nextAction") || "").trim(), createdAt: now, cycleId: current.cycle.id }, ...current.growthGoals] };
      const selectedProjectId = String(data.get("projectId") || "");
      const inbox: ProjectBoard = { id: `inbox-${id}`, name: "Inbox", description: "Ticket cepat yang belum dikelompokkan.", color: "#2563eb", archived: false, createdAt: now };
      const projectId = selectedProjectId || current.projects.find((project) => !project.archived)?.id || inbox.id;
      return {
        ...current,
        projects: current.projects.some((project) => project.id === projectId) ? current.projects : [inbox, ...current.projects],
        tickets: [{ id, projectId, title, description: "", status: "backlog", priority: "medium", labels: [], dueDate: "", checklist: [], comments: [], archived: false, order: 0, createdAt: now, updatedAt: now }, ...current.tickets]
      };
    });
    event.currentTarget.reset();
    close();
  }

  const selected = choices.find((choice) => choice.id === kind)!;
  return <>
    <button type="button" className="quick-capture-button fixed bottom-5 right-5 z-40" onClick={() => setOpen(true)} aria-label="Tambah cepat"><Plus className="h-5 w-5" /><span className="hidden sm:inline">Tambah cepat</span></button>
    {open ? <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/55 p-3 backdrop-blur-sm sm:place-items-center" role="dialog" aria-modal="true" aria-label="Tambah cepat">
      <section className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#081a36]">
        <header className="flex items-center justify-between border-b border-line p-5 dark:border-white/10"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Quick capture</p><h2 className="mt-1 text-xl font-black">Catat sebelum terlupa</h2></div><button type="button" className="button-secondary h-10 w-10 p-0" onClick={close} aria-label="Tutup"><X className="h-4 w-4" /></button></header>
        <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-7">{choices.map(({ id, label, icon: Icon, tone }) => <button type="button" key={id} className={`grid justify-items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-bold transition hover:-translate-y-0.5 ${kind === id ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md" : tone}`} onClick={() => setKind(id)}><Icon className="h-5 w-5" />{label}</button>)}</div>
        <form className="grid gap-4 border-t border-line p-5 dark:border-white/10 sm:grid-cols-2" onSubmit={save} key={kind}>
          <label className="grid gap-2 sm:col-span-2"><span className="label">{kind === "transaction" ? "Catatan transaksi" : kind === "habit" ? "Nama habit" : kind === "focus" ? "Aktivitas fokus" : selected.label}</span><input className="field min-h-11" name="title" autoFocus maxLength={160} required placeholder={`Tulis ${selected.label.toLowerCase()}…`} /></label>
          {kind === "note" ? <label className="grid gap-2 sm:col-span-2"><span className="label">Isi</span><textarea className="field min-h-28 resize-y" name="content" maxLength={5000} /></label> : null}
          {kind === "transaction" ? <><label className="grid gap-2"><span className="label">Jenis</span><select className="field" name="transactionKind"><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label><label className="grid gap-2"><span className="label">Nominal</span><input className="field" name="amount" type="number" min={1} required /></label><label className="grid gap-2"><span className="label">Tanggal</span><input className="field" name="date" type="date" defaultValue={today()} /></label><label className="grid gap-2"><span className="label">Sumber uang</span><select className="field" name="sourceId"><option value="">Belum ditentukan</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label></> : null}
          {kind === "schedule" ? <><label className="grid gap-2"><span className="label">Tanggal</span><input className="field" name="date" type="date" defaultValue={today()} /></label><label className="grid gap-2"><span className="label">Jam mulai</span><input className="field" name="startTime" type="time" defaultValue="09:00" /></label></> : null}
          {kind === "habit" ? <label className="grid gap-2"><span className="label">Frekuensi</span><select className="field" name="frequency"><option value="daily">Harian</option><option value="weekly">Mingguan</option></select></label> : null}
          {kind === "ticket" ? <label className="grid gap-2"><span className="label">Proyek</span><select className="field" name="projectId"><option value="">Inbox otomatis</option>{workspace.projects.filter((project) => !project.archived).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label> : null}
          {kind === "focus" || kind === "goal" ? <label className="grid gap-2"><span className="label">Area hidup</span><select className="field" name="area" defaultValue="personal">{growthAreas.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}</select></label> : null}
          {kind === "focus" ? <><label className="grid gap-2"><span className="label">Menit</span><input className="field" name="minutes" type="number" min={1} max={1440} defaultValue={25} /></label><label className="grid gap-2"><span className="label">Goal terkait</span><select className="field" name="linkedGrowthGoalId"><option value="">Tanpa goal</option>{workspace.growthGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label><label className="grid gap-2"><span className="label">Tanggal</span><input className="field" name="date" type="date" defaultValue={today()} /></label></> : null}
          {kind === "goal" ? <label className="grid gap-2"><span className="label">Langkah berikutnya</span><input className="field" name="nextAction" maxLength={240} /></label> : null}
          <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="button-secondary" onClick={close}>Batal</button><button type="submit" className="button-primary"><Plus className="h-4 w-4" />Simpan {selected.label}</button></div>
        </form>
      </section>
    </div> : null}
  </>;
}
