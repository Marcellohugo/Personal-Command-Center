"use client";

import { CalendarDays, CheckCircle2, NotebookPen, PanelsTopLeft, ReceiptText, Search, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { OfflineWorkspace } from "@/lib/offline-workspace";

type Props = {
  workspace: OfflineWorkspace;
  onClose: () => void;
  onNavigate: (section: "notes" | "agenda" | "transaksi" | "goals" | "recurring" | "kebiasaan" | "perkembangan" | "proyek") => void;
};

export function GlobalSearch({ workspace, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("id-ID");
    if (!value) return [];
    return [
      ...workspace.notes.filter((item) => `${item.title} ${item.content} ${(item.tags ?? []).join(" ")}`.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.title, detail: "Note", icon: NotebookPen, section: "notes" as const })),
      ...workspace.transactions.filter((item) => `${item.note} ${item.date}`.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.note || "Transaksi", detail: item.date, icon: ReceiptText, section: "transaksi" as const })),
      ...workspace.schedules.filter((item) => `${item.title} ${item.description} ${item.location ?? ""}`.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.title, detail: `${item.date} · ${item.startTime}`, icon: CalendarDays, section: "agenda" as const })),
      ...workspace.savingGoals.filter((item) => item.name.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.name, detail: "Tujuan tabungan", icon: NotebookPen, section: "goals" as const })),
      ...workspace.recurringItems.filter((item) => `${item.name} ${item.destination}`.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.name, detail: `Berikutnya ${item.nextDate}`, icon: CalendarDays, section: "recurring" as const })),
      ...workspace.habits.filter((item) => item.name.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.name, detail: "Kebiasaan", icon: CheckCircle2, section: "kebiasaan" as const })),
      ...workspace.growthGoals.filter((item) => `${item.title} ${item.nextAction}`.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.title, detail: `Perkembangan · ${item.progress}%`, icon: TrendingUp, section: "perkembangan" as const })),
      ...workspace.focusSessions.filter((item) => `${item.title} ${item.note}`.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.title, detail: `Fokus · ${item.minutes} menit`, icon: TrendingUp, section: "perkembangan" as const })),
      ...workspace.tickets.filter((item) => `${item.title} ${item.description} ${item.labels.join(" ")}`.toLocaleLowerCase("id-ID").includes(value)).map((item) => ({ id: item.id, title: item.title, detail: `Ticket · ${item.status.replace("_", " ")}`, icon: PanelsTopLeft, section: "proyek" as const }))
    ].slice(0, 20);
  }, [query, workspace]);

  return <div className="fixed inset-0 z-50 bg-ink/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pencarian global" onClick={onClose}><div className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-2xl bg-paper shadow-panel dark:bg-[#17201b]" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-line p-4 dark:border-white/10"><Search className="h-5 w-5 text-clay" /><input autoFocus className="min-w-0 flex-1 bg-transparent text-base outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari notes, agenda, transaksi, tujuan…" /><button type="button" className="button-secondary h-9 w-9 justify-center p-0" onClick={onClose} aria-label="Tutup pencarian"><X className="h-4 w-4" /></button></div><div className="max-h-[60vh] overflow-y-auto p-3">{query && results.length === 0 ? <p className="p-5 text-center text-sm text-ink/50 dark:text-paper/50">Tidak ada hasil.</p> : null}{results.map((result) => { const Icon = result.icon; return <button type="button" className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-ink/5 dark:hover:bg-white/5" key={`${result.section}-${result.id}`} onClick={() => { onNavigate(result.section); onClose(); }}><span className="grid h-9 w-9 place-items-center rounded-lg bg-clay/10 text-clay"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{result.title}</strong><span className="mt-1 block text-xs text-ink/45 dark:text-paper/45">{result.detail}</span></span></button>; })}</div></div></div>;
}
