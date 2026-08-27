"use client";

import {
  Archive,
  ArchiveRestore,
  Bell,
  BookOpenText,
  Download,
  FileDown,
  FilePlus2,
  History,
  Link2,
  ListChecks,
  NotebookPen,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ensureAttachmentBudget, fileToAttachment, linkedAttachment } from "@/lib/attachments";
import {
  builtInNoteTemplates,
  entityLabel,
  exportNotesMarkdown,
  extractNoteTasks,
  noteBacklinks,
  noteFromTemplate,
  noteSummary,
  relatedNotes,
  searchNotes,
  withNoteVersion
} from "@/lib/notes";
import type { Note, NoteTemplate, OfflineWorkspace, SavedNoteSearch, WorkspaceAttachment, WorkspaceEntityLink, WorkspaceEntityType } from "@/lib/offline-workspace";

type Props = {
  workspace: OfflineWorkspace;
  updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void;
};

function dateOnly() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function download(name: string, value: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safe(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function printNote(note: Note) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;
  popup.opener = null;
  popup.document.write(`<html><head><title>${safe(note.title)}</title><style>body{font:16px/1.7 system-ui;max-width:760px;margin:48px auto;padding:0 24px;color:#102445}h1{color:#1559c5}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>${safe(note.title)}</h1><p>${safe(note.folder ?? "")} ${(note.tags ?? []).map((tag) => `#${safe(tag)}`).join(" ")}</p><pre>${safe(note.content)}</pre><script>window.print()<\/script></body></html>`);
  popup.document.close();
}

function Markdown({ value, onToggle }: { value: string; onToggle?: (line: number) => void }) {
  return <div className="grid gap-2 text-sm leading-7">{value.split("\n").map((line, index) => {
    if (/^###\s/.test(line)) return <h4 className="mt-2 text-base font-black" key={index}>{line.slice(4)}</h4>;
    if (/^##\s/.test(line)) return <h3 className="mt-3 text-lg font-black text-blue-800 dark:text-blue-200" key={index}>{line.slice(3)}</h3>;
    if (/^#\s/.test(line)) return <h2 className="mt-4 text-xl font-black text-blue-900 dark:text-blue-100" key={index}>{line.slice(2)}</h2>;
    if (/^(?:☐|\[ \]|- \[ \])\s*/.test(line)) return <button type="button" className="flex items-start gap-2 text-left" onClick={() => onToggle?.(index)} key={index}><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded border border-blue-400" />{line.replace(/^(?:☐|\[ \]|- \[ \])\s*/, "")}</button>;
    if (/^(?:☑|\[x\]|- \[x\])\s*/i.test(line)) return <button type="button" className="flex items-start gap-2 text-left text-ink/40 line-through dark:text-paper/40" onClick={() => onToggle?.(index)} key={index}><span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded bg-blue-600 text-xs text-white">✓</span>{line.replace(/^(?:☑|\[x\]|- \[x\])\s*/i, "")}</button>;
    if (/^(?:•|-|\*)\s/.test(line)) return <p className="pl-4" key={index}>• {line.replace(/^(?:•|-|\*)\s/, "")}</p>;
    if (/^>\s/.test(line)) return <blockquote className="border-l-4 border-blue-300 pl-3 italic text-ink/60 dark:text-paper/60" key={index}>{line.slice(2)}</blockquote>;
    return line ? <p className="whitespace-pre-wrap" key={index}>{line}</p> : <span className="h-2" key={index} />;
  })}</div>;
}

function entityOptions(workspace: OfflineWorkspace, type: WorkspaceEntityType) {
  if (type === "note") return workspace.notes.filter((note) => (note.status ?? "active") === "active").map((item) => ({ id: item.id, label: item.title }));
  if (type === "schedule") return workspace.schedules.map((item) => ({ id: item.id, label: `${item.date} · ${item.title}` }));
  if (type === "transaction") return workspace.transactions.map((item) => ({ id: item.id, label: `${item.date} · ${item.payee || item.note || item.kind}` }));
  if (type === "savingGoal") return workspace.savingGoals.map((item) => ({ id: item.id, label: item.name }));
  if (type === "growthGoal") return workspace.growthGoals.map((item) => ({ id: item.id, label: item.title }));
  if (type === "habit") return workspace.habits.map((item) => ({ id: item.id, label: item.name }));
  if (type === "ticket") return workspace.tickets.map((item) => ({ id: item.id, label: item.title }));
  return workspace.projects.map((item) => ({ id: item.id, label: item.name }));
}

const linkTypes: Array<{ value: WorkspaceEntityType; label: string }> = [
  { value: "note", label: "Note" }, { value: "schedule", label: "Agenda" }, { value: "transaction", label: "Transaksi" }, { value: "savingGoal", label: "Tujuan tabungan" }, { value: "growthGoal", label: "Tujuan perkembangan" }, { value: "habit", label: "Kebiasaan" }, { value: "ticket", label: "Ticket" }, { value: "project", label: "Proyek" }
];

export function NotesCenter({ workspace, updateWorkspace }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<NonNullable<Note["status"]>>("active");
  const [folder, setFolder] = useState("");
  const [tag, setTag] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(workspace.notes.find((note) => (note.status ?? "active") === "active")?.id ?? null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [seed, setSeed] = useState<ReturnType<typeof noteFromTemplate> | null>(null);
  const [attachments, setAttachments] = useState<WorkspaceAttachment[]>([]);
  const [links, setLinks] = useState<WorkspaceEntityLink[]>([]);
  const [linkType, setLinkType] = useState<WorkspaceEntityType>("note");
  const [linkId, setLinkId] = useState("");
  const folders = useMemo(() => [...new Set(workspace.notes.map((note) => note.folder).filter(Boolean) as string[])].sort(), [workspace.notes]);
  const tags = useMemo(() => [...new Set(workspace.notes.flatMap((note) => note.tags ?? []))].sort(), [workspace.notes]);
  const visible = useMemo(() => searchNotes(workspace.notes, { query, status, folder: folder || undefined, tag: tag || undefined }), [folder, query, status, tag, workspace.notes]);
  const selected = visible.find(({ id }) => id === selectedId) ?? visible[0];
  const editing = editingId && editingId !== "new" ? workspace.notes.find(({ id }) => id === editingId) : undefined;
  const templates = [...builtInNoteTemplates, ...workspace.noteTemplates];

  function openEditor(note?: Note, template?: NoteTemplate) {
    const templateSeed = template ? noteFromTemplate(template) : null;
    setEditingId(note?.id ?? "new");
    setSeed(templateSeed);
    setAttachments(note?.attachments ?? []);
    setLinks(note?.links ?? []);
  }

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const previous = editing;
    const note: Note = withNoteVersion(previous, {
      id: previous?.id ?? crypto.randomUUID(),
      title: String(data.get("title") || "Note tanpa judul").trim().slice(0, 120),
      content: String(data.get("content") || "").trim(),
      pinned: data.get("pinned") === "on",
      updatedAt: now,
      folder: String(data.get("folder") || "").trim() || undefined,
      tags: [...new Set(String(data.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 20),
      status: previous?.status ?? "active",
      journalDate: seed?.journalDate ?? previous?.journalDate,
      templateId: seed?.templateId ?? previous?.templateId,
      reminderAt: String(data.get("reminderAt") || "") ? new Date(String(data.get("reminderAt"))).toISOString() : undefined,
      attachments,
      links,
      versions: previous?.versions ?? []
    });
    updateWorkspace((current) => ({ ...current, notes: [note, ...current.notes.filter(({ id }) => id !== note.id)] }));
    setStatus(note.status ?? "active");
    setSelectedId(note.id);
    setEditingId(null);
    setSeed(null);
  }

  function saveTemplate(form: HTMLFormElement | null) {
    if (!form) return;
    const data = new FormData(form);
    const name = window.prompt("Nama template", String(data.get("title") || "Template baru"));
    if (!name?.trim()) return;
    const template: NoteTemplate = { id: crypto.randomUUID(), name: name.trim(), title: String(data.get("title") || ""), content: String(data.get("content") || ""), folder: String(data.get("folder") || "") || undefined, tags: String(data.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean) };
    updateWorkspace((current) => ({ ...current, noteTemplates: [template, ...current.noteTemplates] }));
  }

  function changeStatus(note: Note, next: NonNullable<Note["status"]>) {
    updateWorkspace((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, status: next, deletedAt: next === "trashed" ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() } : item) }));
    setSelectedId(null);
  }

  function toggleChecklist(note: Note, lineIndex: number) {
    const lines = note.content.split("\n");
    lines[lineIndex] = /^(?:☑|\[x\]|- \[x\])/i.test(lines[lineIndex]) ? lines[lineIndex].replace(/^(?:☑|\[x\]|- \[x\])\s*/i, "☐ ") : lines[lineIndex].replace(/^(?:☐|\[ \]|- \[ \])\s*/, "☑ ");
    updateWorkspace((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? withNoteVersion(item, { ...item, content: lines.join("\n"), updatedAt: new Date().toISOString() }) : item) }));
  }

  function restoreVersion(note: Note, versionId: string) {
    const version = note.versions?.find(({ id }) => id === versionId);
    if (!version) return;
    updateWorkspace((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? withNoteVersion(item, { ...item, title: version.title, content: version.content, updatedAt: new Date().toISOString() }) : item) }));
  }

  function createDailyJournal() {
    const existing = workspace.notes.find(({ journalDate }) => journalDate === dateOnly());
    if (existing) { setSelectedId(existing.id); setStatus(existing.status ?? "active"); return; }
    openEditor(undefined, builtInNoteTemplates[0]);
  }

  function saveSearch() {
    const name = window.prompt("Nama pencarian tersimpan", query || folder || tag || "Pencarian note");
    if (!name?.trim()) return;
    const saved: SavedNoteSearch = { id: crypto.randomUUID(), name: name.trim(), query, folder: folder || undefined, tag: tag || undefined, status };
    updateWorkspace((current) => ({ ...current, savedNoteSearches: [saved, ...current.savedNoteSearches].slice(0, 50) }));
  }

  function taskToTicket(text: string) {
    updateWorkspace((current) => {
      const project = current.projects[0] ?? { id: crypto.randomUUID(), name: "Inbox", description: "Tugas hasil konversi catatan", color: "#2563eb", archived: false, createdAt: new Date().toISOString() };
      const now = new Date().toISOString();
      return { ...current, projects: current.projects.length ? current.projects : [project], tickets: [{ id: crypto.randomUUID(), projectId: project.id, title: text, description: selected ? `Dari note: ${selected.title}` : "Dari note", status: "backlog", priority: "medium", labels: ["dari-note"], dueDate: "", checklist: [], comments: [], archived: false, order: 0, createdAt: now, updatedAt: now }, ...current.tickets] };
    });
  }

  function taskToAgenda(text: string) {
    updateWorkspace((current) => ({ ...current, schedules: [{ id: crypto.randomUUID(), title: text, description: selected ? `Dari note: ${selected.title}` : "Dari note", date: dateOnly(), startTime: "09:00", status: "planned", recurrence: "none", linkedNoteId: selected?.id, source: "manual" }, ...current.schedules] }));
  }

  const related = selected ? relatedNotes(workspace.notes, selected) : [];
  const backlinks = selected ? noteBacklinks(workspace.notes, selected.id) : [];
  const incomingLinks: WorkspaceEntityLink[] = selected ? [
    ...workspace.transactions.filter(({ linkedNoteId }) => linkedNoteId === selected.id).map(({ id }) => ({ type: "transaction" as const, id })),
    ...workspace.schedules.filter(({ linkedNoteId }) => linkedNoteId === selected.id).map(({ id }) => ({ type: "schedule" as const, id }))
  ] : [];
  const tasks = selected ? extractNoteTasks(selected) : [];

  return (
    <section className="grid gap-5">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Second brain</p><h2 className="mt-1 text-3xl font-black">Catatan & Pengetahuan</h2><p className="mt-2 text-sm text-ink/55 dark:text-paper/55">Jurnal, Markdown, versi, lampiran, relasi, tugas, arsip, dan pencarian dalam satu ruang.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="button-secondary" onClick={createDailyJournal}><BookOpenText className="h-4 w-4" />Jurnal hari ini</button><button type="button" className="button-secondary" onClick={() => download("semua-catatan.md", exportNotesMarkdown(workspace.notes))}><Download className="h-4 w-4" />Ekspor Markdown</button><button type="button" className="button-primary" onClick={() => openEditor()}><Plus className="h-4 w-4" />Note baru</button></div></header>

      <section className="panel grid gap-3 rounded-2xl p-3 lg:grid-cols-[1fr_180px_160px_160px_auto]">
        <label className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 dark:bg-blue-400/10"><Search className="h-4 w-4 text-blue-600" /><input className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, isi, tag, atau hasil OCR…" /></label>
        <select className="field" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setSelectedId(null); }}><option value="active">Aktif</option><option value="archived">Arsip</option><option value="trashed">Sampah</option></select>
        <select className="field" value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">Semua folder</option>{folders.map((item) => <option key={item}>{item}</option>)}</select>
        <select className="field" value={tag} onChange={(event) => setTag(event.target.value)}><option value="">Semua tag</option>{tags.map((item) => <option key={item}>{item}</option>)}</select>
        <button className="button-secondary" type="button" onClick={saveSearch}><Save className="h-4 w-4" />Simpan filter</button>
      </section>

      {workspace.savedNoteSearches.length ? <div className="flex gap-2 overflow-x-auto">{workspace.savedNoteSearches.map((saved) => <span className="flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 text-xs font-bold text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200" key={saved.id}><button className="px-3 py-2" type="button" onClick={() => { setQuery(saved.query); setFolder(saved.folder ?? ""); setTag(saved.tag ?? ""); setStatus(saved.status ?? "active"); }}>{saved.name}</button><button className="pr-3" type="button" aria-label={`Hapus ${saved.name}`} onClick={() => updateWorkspace((current) => ({ ...current, savedNoteSearches: current.savedNoteSearches.filter(({ id }) => id !== saved.id) }))}>×</button></span>)}</div> : null}

      <section className="grid min-h-[62vh] gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="panel overflow-hidden rounded-2xl"><div className="border-b border-line p-3 dark:border-white/10"><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Template cepat</p><div className="mt-2 flex gap-2 overflow-x-auto">{templates.slice(0, 8).map((template) => <button className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 dark:bg-blue-400/10 dark:text-blue-200" type="button" key={template.id} onClick={() => openEditor(undefined, template)}>{template.name}</button>)}</div></div><div className="max-h-[66vh] overflow-y-auto p-2">{visible.map((note) => <button type="button" className={`mb-2 w-full rounded-xl p-3 text-left transition ${selected?.id === note.id ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "hover:bg-blue-50 dark:hover:bg-blue-400/10"}`} onClick={() => setSelectedId(note.id)} key={note.id}><div className="flex items-start gap-2">{note.pinned ? <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}<strong className="line-clamp-2 text-sm">{note.title}</strong></div><p className={`mt-1 line-clamp-2 text-xs leading-5 ${selected?.id === note.id ? "text-blue-100" : "text-ink/45 dark:text-paper/45"}`}>{noteSummary(note, 90) || "Note kosong"}</p><p className={`mt-2 text-[10px] ${selected?.id === note.id ? "text-blue-100" : "text-ink/35 dark:text-paper/35"}`}>{note.folder || "Tanpa folder"} · {new Date(note.updatedAt).toLocaleDateString("id-ID")}</p></button>)}{!visible.length ? <div className="grid min-h-60 place-items-center p-6 text-center"><div><NotebookPen className="mx-auto h-7 w-7 text-blue-600" /><p className="mt-3 text-sm text-ink/45 dark:text-paper/45">Tidak ada note yang cocok.</p></div></div> : null}</div></aside>

        <article className="panel rounded-2xl p-5 sm:p-7">{selected ? <>
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between dark:border-white/10"><div className="min-w-0"><div className="flex items-center gap-2">{selected.pinned ? <Pin className="h-4 w-4 text-amber-500" /> : null}<h3 className="break-words text-2xl font-black">{selected.title}</h3></div><p className="mt-2 text-xs text-ink/45 dark:text-paper/45">{selected.folder || "Tanpa folder"}{selected.tags?.length ? ` · ${selected.tags.map((item) => `#${item}`).join(" ")}` : ""} · diperbarui {new Date(selected.updatedAt).toLocaleString("id-ID")}</p></div><div className="flex flex-wrap gap-2"><button className="button-secondary px-3" type="button" onClick={() => updateWorkspace((current) => ({ ...current, notes: current.notes.map((item) => item.id === selected.id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item) }))}><Pin className="h-4 w-4" /></button><button className="button-secondary" type="button" onClick={() => openEditor(selected)}><Pencil className="h-4 w-4" />Ubah</button><button className="button-secondary" type="button" onClick={() => printNote(selected)}><FileDown className="h-4 w-4" />PDF</button>{status === "active" ? <button className="button-secondary" type="button" onClick={() => changeStatus(selected, "archived")}><Archive className="h-4 w-4" />Arsipkan</button> : null}{status === "archived" ? <button className="button-secondary" type="button" onClick={() => changeStatus(selected, "active")}><ArchiveRestore className="h-4 w-4" />Aktifkan</button> : null}{status !== "trashed" ? <button className="button-danger" type="button" onClick={() => changeStatus(selected, "trashed")}><Trash2 className="h-4 w-4" />Sampah</button> : <><button className="button-secondary" type="button" onClick={() => changeStatus(selected, "active")}><RotateCcw className="h-4 w-4" />Pulihkan</button><button className="button-danger" type="button" onClick={() => { if (confirm("Hapus permanen note ini?")) updateWorkspace((current) => ({ ...current, notes: current.notes.filter(({ id }) => id !== selected.id) })); }}><Trash2 className="h-4 w-4" />Permanen</button></>}</div></div>
          <div className="py-6"><Markdown value={selected.content} onToggle={(line) => toggleChecklist(selected, line)} /></div>
          {selected.reminderAt ? <p className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200"><Bell className="h-4 w-4" />Pengingat {new Date(selected.reminderAt).toLocaleString("id-ID")}</p> : null}
          {selected.attachments?.length ? <section className="border-t border-line pt-5 dark:border-white/10"><h4 className="flex items-center gap-2 font-black"><Paperclip className="h-4 w-4 text-blue-600" />Lampiran</h4><div className="mt-3 flex flex-wrap gap-2">{selected.attachments.map((item) => <a className="button-secondary" href={item.url ?? item.dataUrl} target="_blank" rel="noreferrer" key={item.id}>{item.name}{item.extractedText ? " · OCR" : ""}</a>)}</div></section> : null}
          {selected.links?.length || incomingLinks.length ? <section className="mt-5 border-t border-line pt-5 dark:border-white/10"><h4 className="flex items-center gap-2 font-black"><Link2 className="h-4 w-4 text-blue-600" />Terhubung dua arah</h4><div className="mt-3 flex flex-wrap gap-2">{[...(selected.links ?? []), ...incomingLinks].filter((link, index, rows) => rows.findIndex((item) => item.type === link.type && item.id === link.id) === index).map((link) => <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 dark:bg-blue-400/10 dark:text-blue-200" key={`${link.type}:${link.id}`}>{linkTypes.find(({ value }) => value === link.type)?.label}: {entityLabel(workspace, link) ?? "Item lama"}</span>)}</div></section> : null}
          <section className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-3 dark:border-white/10"><div><h4 className="flex items-center gap-2 font-black"><Sparkles className="h-4 w-4 text-blue-600" />Ringkasan</h4><p className="mt-2 text-sm leading-6 text-ink/55 dark:text-paper/55">{noteSummary(selected) || "Belum ada isi untuk diringkas."}</p></div><div><h4 className="font-black">Backlink & terkait</h4><div className="mt-2 grid gap-1">{[...backlinks, ...related].filter((item, index, rows) => rows.findIndex(({ id }) => id === item.id) === index).slice(0, 6).map((note) => <button className="text-left text-sm font-bold text-blue-700 hover:underline dark:text-blue-300" type="button" onClick={() => { setSelectedId(note.id); setStatus(note.status ?? "active"); }} key={note.id}>{note.title}</button>)}{!backlinks.length && !related.length ? <p className="text-sm text-ink/45 dark:text-paper/45">Belum ada note terkait.</p> : null}</div></div><div><h4 className="flex items-center gap-2 font-black"><ListChecks className="h-4 w-4 text-blue-600" />Tugas ({tasks.length})</h4><div className="mt-2 grid gap-2">{tasks.slice(0, 6).map((task) => <div className="rounded-lg bg-blue-50 p-2 text-xs dark:bg-blue-400/10" key={task}><p className="font-bold">{task}</p><div className="mt-2 flex gap-1"><button type="button" className="rounded bg-white px-2 py-1 font-bold text-blue-700 dark:bg-white/10 dark:text-blue-200" onClick={() => taskToTicket(task)}>→ Ticket</button><button type="button" className="rounded bg-white px-2 py-1 font-bold text-blue-700 dark:bg-white/10 dark:text-blue-200" onClick={() => taskToAgenda(task)}>→ Agenda</button></div></div>)}{!tasks.length ? <p className="text-sm text-ink/45 dark:text-paper/45">Gunakan “☐ tugas” di editor.</p> : null}</div></div></section>
          {selected.versions?.length ? <details className="mt-5 border-t border-line pt-5 dark:border-white/10"><summary className="flex cursor-pointer items-center gap-2 font-black"><History className="h-4 w-4 text-blue-600" />Riwayat versi ({selected.versions.length})</summary><div className="mt-3 grid gap-2">{[...selected.versions].reverse().map((version) => <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm dark:border-white/10" key={version.id}><div><strong>{version.title}</strong><p className="text-xs text-ink/45 dark:text-paper/45">{new Date(version.updatedAt).toLocaleString("id-ID")}</p></div><button className="button-secondary" type="button" onClick={() => restoreVersion(selected, version.id)}>Pulihkan</button></div>)}</div></details> : null}
        </> : <div className="grid min-h-96 place-items-center text-center"><div><NotebookPen className="mx-auto h-9 w-9 text-blue-600" /><h3 className="mt-3 text-xl font-black">Pilih atau buat note</h3><p className="mt-2 text-sm text-ink/45 dark:text-paper/45">Workspace pengetahuan Anda siap diisi.</p></div></div>}</article>
      </section>

      {editingId ? <div className="fixed inset-0 z-50 overflow-y-auto bg-[#061225]/75 p-3 backdrop-blur-sm sm:p-8"><form className="mx-auto grid max-w-4xl gap-4 rounded-3xl bg-white p-5 shadow-2xl sm:grid-cols-2 sm:p-8 dark:bg-[#0b1f3a]" onSubmit={saveNote} key={editing?.id ?? seed?.templateId ?? "new"}><div className="flex items-start justify-between gap-4 sm:col-span-2"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Editor Markdown</p><h3 className="text-2xl font-black">{editing ? "Ubah note" : "Note baru"}</h3></div><button type="button" className="button-secondary px-3" onClick={() => { setEditingId(null); setSeed(null); }}><X className="h-4 w-4" /></button></div><label className="grid gap-1 sm:col-span-2"><span className="label">Judul</span><input className="field" name="title" defaultValue={editing?.title ?? seed?.title ?? ""} required maxLength={120} /></label><label className="grid gap-1"><span className="label">Folder</span><input className="field" name="folder" defaultValue={editing?.folder ?? seed?.folder ?? ""} list="note-folders" /><datalist id="note-folders">{folders.map((item) => <option key={item}>{item}</option>)}</datalist></label><label className="grid gap-1"><span className="label">Tag (pisahkan koma)</span><input className="field" name="tags" defaultValue={(editing?.tags ?? seed?.tags ?? []).join(", ")} /></label><label className="grid gap-1"><span className="label">Pengingat</span><input className="field" name="reminderAt" type="datetime-local" defaultValue={editing?.reminderAt?.slice(0, 16)} /></label><label className="flex items-center gap-2 self-end rounded-xl border border-line px-3 py-2 text-sm font-bold dark:border-white/10"><input type="checkbox" name="pinned" defaultChecked={editing?.pinned} />Sematkan note</label><label className="grid gap-1 sm:col-span-2"><span className="label">Isi</span><textarea className="field min-h-80 font-mono leading-7" name="content" defaultValue={editing?.content ?? seed?.content ?? ""} placeholder={"# Judul bagian\n\nTulis isi…\n\n☐ Tugas yang bisa dikonversi"} maxLength={200000} /></label>
        <section className="grid gap-3 rounded-2xl bg-blue-50 p-4 sm:col-span-2 dark:bg-blue-400/10"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black">Lampiran</h4><div className="flex flex-wrap gap-2"><label className="button-secondary cursor-pointer"><Paperclip className="h-4 w-4" />Unggah<input className="sr-only" type="file" accept="image/*,.pdf,text/plain" disabled={attachments.length >= 4} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; void fileToAttachment(file).then((item) => ensureAttachmentBudget(workspace, item)).then((item) => setAttachments((current) => [...current, item].slice(0, 4))).catch((error: unknown) => alert(error instanceof Error ? error.message : "Lampiran gagal.")); event.target.value = ""; }} /></label><button className="button-secondary" type="button" onClick={() => { const url = prompt("URL lampiran"); if (!url) return; const name = prompt("Nama lampiran", "Tautan") ?? "Tautan"; try { setAttachments((current) => [...current, linkedAttachment(name, url)].slice(0, 4)); } catch (error) { alert(error instanceof Error ? error.message : "URL tidak valid."); } }}><Link2 className="h-4 w-4" />Tautan</button></div></div><div className="flex flex-wrap gap-2">{attachments.map((item) => <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blue-800 dark:bg-white/10 dark:text-blue-100" key={item.id}>{item.name}<button type="button" onClick={() => setAttachments((current) => current.filter(({ id }) => id !== item.id))}>×</button></span>)}{!attachments.length ? <span className="text-xs text-blue-700/60 dark:text-blue-100/50">Belum ada lampiran. OCR gambar bersifat otomatis bila tersedia.</span> : null}</div></section>
        <section className="grid gap-3 rounded-2xl border border-line p-4 sm:col-span-2 dark:border-white/10"><h4 className="font-black">Hubungkan dengan seluruh workspace</h4><div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]"><select className="field" value={linkType} onChange={(event) => { setLinkType(event.target.value as WorkspaceEntityType); setLinkId(""); }}>{linkTypes.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><select className="field" value={linkId} onChange={(event) => setLinkId(event.target.value)}><option value="">Pilih item</option>{entityOptions(workspace, linkType).filter((item) => item.id !== editing?.id).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select><button className="button-secondary" type="button" onClick={() => { if (!linkId || links.some((item) => item.type === linkType && item.id === linkId)) return; setLinks((current) => [...current, { type: linkType, id: linkId }]); setLinkId(""); }}><Plus className="h-4 w-4" />Hubungkan</button></div><div className="flex flex-wrap gap-2">{links.map((link) => <span className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 dark:bg-blue-400/10 dark:text-blue-200" key={`${link.type}:${link.id}`}>{entityLabel(workspace, link) ?? "Item"}<button type="button" onClick={() => setLinks((current) => current.filter((item) => item.type !== link.type || item.id !== link.id))}>×</button></span>)}</div></section>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="button-primary" type="submit"><Save className="h-4 w-4" />Simpan note</button><button className="button-secondary" type="button" onClick={(event) => saveTemplate(event.currentTarget.form)}><FilePlus2 className="h-4 w-4" />Jadikan template</button><button className="button-secondary" type="button" onClick={() => { setEditingId(null); setSeed(null); }}>Batal</button></div></form></div> : null}
    </section>
  );
}
