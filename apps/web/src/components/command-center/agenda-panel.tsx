"use client";

import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { calendarRange, weekRange, type CalendarPeriod } from "@/lib/date";
import { upsertById, type OfflineWorkspace, type WorkspaceSchedule } from "@/lib/offline-workspace";
import { formatDateInput } from "@/lib/utils";
import { advanceRecurringDate } from "@/lib/workspace-finance";

type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
};

const periodLabels: Record<CalendarPeriod, string> = { day: "Harian", week: "Mingguan", month: "Bulanan" };

function dateOnly(date: Date) {
  return formatDateInput(date);
}

function addDays(value: Date, amount: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function expandSchedule(schedule: WorkspaceSchedule, from: string, to: string) {
  const result: WorkspaceSchedule[] = [];
  let current = new Date(`${schedule.date}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const first = new Date(`${from}T12:00:00`);
  while (current <= end) {
    if (current >= first) result.push({ ...schedule, date: dateOnly(current) });
    if (schedule.recurrence === "none") break;
    if (schedule.recurrence === "daily") current = addDays(current, 1);
    else if (schedule.recurrence === "weekly") current = addDays(current, 7);
    else current = new Date(`${advanceRecurringDate(dateOnly(current), "monthly")}T12:00:00`);
  }
  return result;
}

function dateTitle(value: string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

export function AgendaPanel({ workspace, updateWorkspace }: Props) {
  const [period, setPeriod] = useState<CalendarPeriod>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => dateOnly(new Date()));
  const editing = workspace.schedules.find(({ id }) => id === editingId);
  const selectedRange = calendarRange(period, anchor);
  const range = period === "month"
    ? { gte: weekRange(selectedRange.gte).gte, lte: weekRange(selectedRange.lte).lte }
    : selectedRange;
  const from = dateOnly(range.gte);
  const to = dateOnly(range.lte);
  const dates = useMemo(() => {
    if (period === "day") return [new Date(`${from}T12:00:00`)];
    const values: Date[] = [];
    for (let current = new Date(`${from}T12:00:00`); current <= range.lte; current = addDays(current, 1)) values.push(new Date(current));
    return values;
  }, [from, period, range.lte]);
  const expanded = useMemo(() => workspace.schedules.flatMap((schedule) => expandSchedule(schedule, from, to)), [from, to, workspace.schedules]);

  function move(amount: number) {
    const next = new Date(anchor);
    if (period === "day") next.setDate(next.getDate() + amount);
    else if (period === "week") next.setDate(next.getDate() + amount * 7);
    else next.setMonth(next.getMonth() + amount);
    setAnchor(next);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const schedule: WorkspaceSchedule = {
      ...editing,
      id: editing?.id ?? crypto.randomUUID(),
      title: String(data.get("title") || "").trim(),
      description: String(data.get("description") || "").trim(),
      date: String(data.get("date") || selectedDate),
      startTime: String(data.get("startTime") || "09:00"),
      endTime: String(data.get("endTime") || "") || undefined,
      location: String(data.get("location") || "").trim() || undefined,
      status: data.get("status") as WorkspaceSchedule["status"],
      recurrence: data.get("recurrence") as WorkspaceSchedule["recurrence"],
      reminderMinutes: Number(data.get("reminderMinutes")) || 0,
      linkedNoteId: String(data.get("linkedNoteId") || "") || undefined,
      linkedGrowthGoalId: String(data.get("linkedGrowthGoalId") || "") || undefined
    };
    updateWorkspace((current) => ({ ...current, schedules: upsertById(current.schedules, schedule) }));
    setEditingId(null);
    setShowForm(false);
    setSelectedDate(schedule.date);
    setAnchor(new Date(`${schedule.date}T12:00:00`));
  }

  function toggleStatus(schedule: WorkspaceSchedule) {
    updateWorkspace((current) => ({ ...current, schedules: current.schedules.map((item) => item.id === schedule.id ? { ...item, status: item.status === "completed" ? "planned" : "completed" } : item) }));
  }

  function remove(id: string) {
    if (!confirm("Hapus jadwal ini dan seluruh pengulangannya?")) return;
    updateWorkspace((current) => {
      const removed = current.schedules.find((item) => item.id === id);
      return {
        ...current,
        schedules: current.schedules.filter(({ id: currentId }) => currentId !== id),
        settings: removed?.googleEventId
          ? { ...current.settings, deletedGoogleEventIds: Array.from(new Set([...current.settings.deletedGoogleEventIds, removed.googleEventId])) }
          : current.settings
      };
    });
  }

  const renderDay = (date: Date) => {
    const key = dateOnly(date);
    const items = expanded.filter((item) => item.date === key);
    const outsideMonth = period === "month" && (date.getMonth() !== anchor.getMonth() || date.getFullYear() !== anchor.getFullYear());
    return <div className={`min-h-36 rounded-xl border p-3 ${key === selectedDate ? "border-clay bg-clay/5" : "border-line dark:border-white/10"} ${outsideMonth ? "opacity-45" : ""}`} key={key} onClick={() => { setSelectedDate(key); setAnchor(new Date(`${key}T12:00:00`)); }}><div className="flex items-center justify-between gap-2"><button type="button" className="text-left text-xs font-black" onClick={() => { setSelectedDate(key); setShowForm(true); }}><span className="block text-ink/45 dark:text-paper/45">{new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date)}</span><span className="mt-1 block text-lg">{date.getDate()}</span></button><button type="button" className="button-secondary h-8 w-8 justify-center p-0" onClick={() => { setSelectedDate(key); setShowForm(true); }} aria-label={`Tambah jadwal ${key}`}><Plus className="h-4 w-4" /></button></div><div className="mt-3 grid gap-2">{items.map((item) => <button className={`rounded-lg p-2 text-left text-xs ${item.status === "completed" ? "bg-moss/10 text-moss line-through" : "bg-ink/5 dark:bg-white/5"}`} key={`${item.id}-${item.date}`} type="button" onClick={() => { setEditingId(item.id); setShowForm(true); }}><span className="font-black">{item.startTime} · {item.title}</span>{item.location ? <span className="mt-1 flex items-center gap-1 opacity-60"><MapPin className="h-3 w-3" />{item.location}</span> : null}</button>)}</div></div>;
  };

  return <section className="grid gap-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-moss dark:text-emerald-300">Agenda terpadu</p><h2 className="text-3xl font-black">Jadwal</h2></div><button type="button" className="button-primary" onClick={() => { setEditingId(null); setShowForm(true); }}><Plus className="h-4 w-4" />Tambah jadwal</button></header>
    <div className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"><div className="flex gap-1 rounded-lg bg-ink/5 p-1 dark:bg-white/5">{(Object.keys(periodLabels) as CalendarPeriod[]).map((value) => <button type="button" key={value} onClick={() => setPeriod(value)} className={`rounded-md px-3 py-2 text-xs font-bold ${period === value ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/50 dark:text-paper/50"}`}>{periodLabels[value]}</button>)}</div><div className="flex items-center gap-2"><button type="button" className="button-secondary h-9 w-9 justify-center p-0" onClick={() => move(-1)} aria-label="Periode sebelumnya"><ChevronLeft className="h-4 w-4" /></button><strong className="min-w-40 text-center text-sm">{period === "day" ? dateTitle(from) : period === "week" ? `${dateTitle(from)} – ${dateTitle(to)}` : new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(anchor)}</strong><button type="button" className="button-secondary h-9 w-9 justify-center p-0" onClick={() => move(1)} aria-label="Periode berikutnya"><ChevronRight className="h-4 w-4" /></button></div></div>
    {showForm ? <form className="panel grid gap-4 rounded-xl p-5 sm:grid-cols-2" onSubmit={save}><div className="sm:col-span-2 flex items-center justify-between"><h3 className="text-lg font-black">{editing ? "Ubah jadwal" : "Jadwal baru"}</h3><button type="button" className="button-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}><XCircle className="h-4 w-4" />Batal</button></div><label className="grid gap-2 sm:col-span-2"><span className="label">Judul</span><input className="field" name="title" defaultValue={editing?.title} required maxLength={140} /></label><label className="grid gap-2"><span className="label">Tanggal</span><input className="field" name="date" type="date" defaultValue={editing?.date ?? selectedDate} required /></label><label className="grid gap-2"><span className="label">Mulai</span><input className="field" name="startTime" type="time" defaultValue={editing?.startTime ?? "09:00"} required /></label><label className="grid gap-2"><span className="label">Selesai</span><input className="field" name="endTime" type="time" defaultValue={editing?.endTime} /></label><label className="grid gap-2"><span className="label">Status</span><select className="field" name="status" defaultValue={editing?.status ?? "planned"}><option value="planned">Direncanakan</option><option value="completed">Selesai</option><option value="cancelled">Dibatalkan</option></select></label><label className="grid gap-2"><span className="label">Pengulangan</span><select className="field" name="recurrence" defaultValue={editing?.recurrence ?? "none"}><option value="none">Tidak berulang</option><option value="daily">Setiap hari</option><option value="weekly">Setiap minggu</option><option value="monthly">Setiap bulan</option></select></label><label className="grid gap-2"><span className="label">Pengingat</span><select className="field" name="reminderMinutes" defaultValue={editing?.reminderMinutes ?? 0}><option value="0">Tidak ada</option><option value="5">5 menit sebelumnya</option><option value="15">15 menit sebelumnya</option><option value="30">30 menit sebelumnya</option><option value="60">1 jam sebelumnya</option></select></label><label className="grid gap-2"><span className="label">Lokasi</span><input className="field" name="location" defaultValue={editing?.location} maxLength={100} /></label><label className="grid gap-2"><span className="label">Note terkait</span><select className="field" name="linkedNoteId" defaultValue={editing?.linkedNoteId ?? ""}><option value="">Tidak ada</option>{workspace.notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label><label className="grid gap-2"><span className="label">Goal terkait</span><select className="field" name="linkedGrowthGoalId" defaultValue={editing?.linkedGrowthGoalId ?? ""}><option value="">Tidak ada</option>{workspace.growthGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label><label className="grid gap-2 sm:col-span-2"><span className="label">Deskripsi</span><textarea className="field min-h-20" name="description" defaultValue={editing?.description} maxLength={500} /></label><button className="button-primary w-fit" type="submit">{editing ? "Simpan perubahan" : "Simpan jadwal"}</button></form> : null}
    <div className={period === "day" ? "grid gap-3" : period === "week" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-7" : "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"}>{dates.map(renderDay)}</div>
    {period === "day" && expanded.length === 0 ? <div className="panel rounded-xl p-8 text-center text-sm text-ink/50 dark:text-paper/50"><CalendarDays className="mx-auto h-8 w-8 text-moss" /><p className="mt-3">Belum ada jadwal pada hari ini.</p></div> : null}
    <section className="panel grid gap-3 rounded-xl p-5"><h3 className="font-black">Daftar jadwal periode ini</h3>{expanded.length === 0 ? <p className="text-sm text-ink/50 dark:text-paper/50">Belum ada jadwal.</p> : expanded.map((item) => <div className="flex items-center gap-3 rounded-lg border border-line p-3 dark:border-white/10" key={`${item.id}-list-${item.date}`}><button type="button" className={item.status === "completed" ? "text-moss" : "text-ink/40"} onClick={() => toggleStatus(item)} aria-label="Ubah status jadwal">{item.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</button><div className="min-w-0 flex-1"><p className={`font-bold ${item.status === "completed" ? "line-through opacity-60" : ""}`}>{item.title}</p><p className="text-xs text-ink/50 dark:text-paper/50">{dateTitle(item.date)} · {item.startTime}{item.endTime ? `–${item.endTime}` : ""}</p></div><button type="button" className="button-secondary h-8 w-8 justify-center p-0" onClick={() => { setEditingId(item.id); setShowForm(true); }} aria-label="Ubah jadwal"><Pencil className="h-4 w-4" /></button><button type="button" className="button-danger h-8 w-8 justify-center p-0" onClick={() => remove(item.id)} aria-label="Hapus jadwal"><Trash2 className="h-4 w-4" /></button></div>)}</section>
  </section>;
}
