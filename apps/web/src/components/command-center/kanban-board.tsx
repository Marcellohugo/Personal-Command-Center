"use client";

import { Archive, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, ClipboardList, GripVertical, ListFilter, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from "react";
import type { KanbanStatus, KanbanTicket, OfflineWorkspace, ProjectBoard, TicketPriority } from "@/lib/offline-workspace";
import { cn } from "@/lib/utils";

const columns: Array<{ id: KanbanStatus; label: string; tone: string }> = [
  { id: "backlog", label: "Backlog", tone: "bg-slate-400" },
  { id: "ready", label: "Siap", tone: "bg-sky-500" },
  { id: "in_progress", label: "Dikerjakan", tone: "bg-blue-600" },
  { id: "review", label: "Review", tone: "bg-violet-500" },
  { id: "done", label: "Selesai", tone: "bg-emerald-500" }
];

const priorities: Array<{ id: TicketPriority; label: string; className: string }> = [
  { id: "low", label: "Rendah", className: "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300" },
  { id: "medium", label: "Sedang", className: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300" },
  { id: "high", label: "Tinggi", className: "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-300" },
  { id: "urgent", label: "Mendesak", className: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300" }
];

function id() {
  return crypto.randomUUID();
}

function priority(priorityId: TicketPriority) {
  return priorities.find(({ id }) => id === priorityId)!;
}

export function KanbanBoard({ workspace, updateWorkspace }: { workspace: OfflineWorkspace; updateWorkspace: (updater: (current: OfflineWorkspace) => OfflineWorkspace) => void }) {
  const activeProjects = workspace.projects.filter(({ archived }) => !archived);
  const [projectId, setProjectId] = useState(activeProjects[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [projectForm, setProjectForm] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState(false);

  useEffect(() => {
    if (!workspace.projects.some(({ id }) => id === projectId)) setProjectId(activeProjects[0]?.id ?? workspace.projects[0]?.id ?? "");
  }, [activeProjects, projectId, workspace.projects]);

  const selectedProject = workspace.projects.find(({ id }) => id === projectId);
  const editingTicket = workspace.tickets.find(({ id }) => id === editingTicketId);
  const tickets = useMemo(() => workspace.tickets
    .filter((ticket) => ticket.projectId === projectId && (showArchived || !ticket.archived))
    .filter((ticket) => priorityFilter === "all" || ticket.priority === priorityFilter)
    .filter((ticket) => !query.trim() || `${ticket.title} ${ticket.description} ${ticket.labels.join(" ")}`.toLocaleLowerCase("id-ID").includes(query.trim().toLocaleLowerCase("id-ID")))
    .sort((a, b) => a.order - b.order || b.updatedAt.localeCompare(a.updatedAt)), [priorityFilter, projectId, query, showArchived, workspace.tickets]);
  const completed = tickets.filter(({ status }) => status === "done").length;
  const overdue = tickets.filter(({ dueDate, status }) => dueDate && dueDate < new Date().toISOString().slice(0, 10) && status !== "done").length;

  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const project: ProjectBoard = { id: id(), name: String(data.get("name")).trim(), description: String(data.get("description") || "").trim(), color: String(data.get("color") || "#2563eb"), archived: false, createdAt: new Date().toISOString() };
    if (!project.name) return;
    updateWorkspace((current) => ({ ...current, projects: [project, ...current.projects] }));
    setProjectId(project.id);
    setProjectForm(false);
  }

  function saveTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    const data = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const previous = editingTicket;
    const ticket: KanbanTicket = {
      id: previous?.id ?? id(), projectId, title: String(data.get("title")).trim(), description: String(data.get("description") || "").trim(),
      status: data.get("status") as KanbanStatus, priority: data.get("priority") as TicketPriority,
      labels: Array.from(new Set(String(data.get("labels") || "").split(",").map((label) => label.trim()).filter(Boolean))).slice(0, 10),
      dueDate: String(data.get("dueDate") || ""), checklist: previous?.checklist ?? [], comments: previous?.comments ?? [],
      linkedScheduleId: String(data.get("linkedScheduleId") || "") || undefined,
      linkedGrowthGoalId: String(data.get("linkedGrowthGoalId") || "") || undefined,
      archived: previous?.archived ?? false, order: previous?.order ?? Date.now(), createdAt: previous?.createdAt ?? now, updatedAt: now
    };
    if (!ticket.title) return;
    updateWorkspace((current) => ({ ...current, tickets: current.tickets.some(({ id }) => id === ticket.id) ? current.tickets.map((item) => item.id === ticket.id ? ticket : item) : [...current.tickets, ticket] }));
    setEditingTicketId(ticket.id);
    setTicketForm(true);
  }

  function updateTicket(ticketId: string, updater: (ticket: KanbanTicket) => KanbanTicket) {
    updateWorkspace((current) => ({ ...current, tickets: current.tickets.map((ticket) => ticket.id === ticketId ? { ...updater(ticket), updatedAt: new Date().toISOString() } : ticket) }));
  }

  function move(ticketId: string, status: KanbanStatus) {
    updateTicket(ticketId, (ticket) => ({ ...ticket, status, order: Date.now() }));
  }

  function drop(event: DragEvent, status: KanbanStatus) {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("text/ticket-id");
    if (ticketId) move(ticketId, status);
  }

  function removeTicket(ticket: KanbanTicket) {
    if (!confirm(`Hapus ticket “${ticket.title}”?`)) return;
    updateWorkspace((current) => ({ ...current, tickets: current.tickets.filter(({ id }) => id !== ticket.id) }));
    setTicketForm(false);
    setEditingTicketId(null);
  }

  function archiveProject() {
    if (!selectedProject || !confirm(`Arsipkan proyek “${selectedProject.name}”?`)) return;
    updateWorkspace((current) => ({ ...current, projects: current.projects.map((project) => project.id === selectedProject.id ? { ...project, archived: true } : project) }));
    setProjectId(activeProjects.find(({ id }) => id !== selectedProject.id)?.id ?? "");
  }

  if (workspace.projects.length === 0 && !projectForm) {
    return <section className="panel grid min-h-[60vh] place-items-center rounded-3xl p-8 text-center"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"><ClipboardList className="h-8 w-8" /></span><h2 className="mt-5 text-2xl font-black">Buat board pertama</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/55 dark:text-paper/55">Ubah tujuan besar menjadi ticket kecil yang bergerak dari Backlog sampai Selesai.</p><button type="button" className="button-primary mt-5" onClick={() => setProjectForm(true)}><Plus className="h-4 w-4" />Buat proyek</button></div></section>;
  }

  return <section className="grid gap-5">
    <div className="panel rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="min-w-52 flex-1"><span className="sr-only">Pilih proyek</span><select className="field min-h-11 font-bold" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{workspace.projects.filter((project) => showArchived || !project.archived).map((project) => <option key={project.id} value={project.id}>{project.archived ? "[Arsip] " : ""}{project.name}</option>)}</select></label>
        <button type="button" className="button-secondary min-h-11" onClick={() => setProjectForm(true)}><Plus className="h-4 w-4" />Proyek</button>
        {selectedProject && !selectedProject.archived ? <button type="button" className="button-primary min-h-11" onClick={() => { setEditingTicketId(null); setTicketForm(true); }}><Plus className="h-4 w-4" />Ticket</button> : null}
        {selectedProject && !selectedProject.archived ? <button type="button" className="button-secondary min-h-11" onClick={archiveProject}><Archive className="h-4 w-4" /><span className="hidden sm:inline">Arsipkan proyek</span></button> : null}
      </div>
      {selectedProject ? <div className="mt-4 flex items-start gap-3"><span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: selectedProject.color }} /><div><h2 className="text-xl font-black">{selectedProject.name}</h2>{selectedProject.description ? <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">{selectedProject.description}</p> : null}</div></div> : null}
    </div>

    {projectForm ? <form className="panel grid gap-4 rounded-2xl p-5 sm:grid-cols-[1fr_1.5fr_auto_auto]" onSubmit={saveProject}><label><span className="label">Nama proyek</span><input className="field mt-2" name="name" autoFocus maxLength={120} required /></label><label><span className="label">Deskripsi</span><input className="field mt-2" name="description" maxLength={1000} /></label><label><span className="label">Warna</span><input className="mt-2 h-10 w-16 cursor-pointer rounded-lg border border-line bg-white p-1" name="color" type="color" defaultValue="#2563eb" /></label><div className="flex items-end gap-2"><button className="button-primary" type="submit">Simpan</button><button className="button-secondary" type="button" onClick={() => setProjectForm(false)}>Batal</button></div></form> : null}

    {selectedProject ? <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label: "Total ticket", value: tickets.length }, { label: "Dikerjakan", value: tickets.filter(({ status }) => status === "in_progress").length }, { label: "Selesai", value: completed }, { label: "Terlambat", value: overdue }].map((metric) => <article className="panel rounded-xl p-4" key={metric.label}><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">{metric.label}</p><p className="mt-2 text-2xl font-black">{metric.value}</p></article>)}
      </div>
      <div className="flex flex-wrap gap-2"><label className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink/40" /><input className="field min-h-10 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari ticket atau label…" /></label><label className="flex items-center gap-2"><ListFilter className="h-4 w-4 text-clay" /><select className="field min-h-10" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as TicketPriority | "all")}><option value="all">Semua prioritas</option>{priorities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button type="button" className={cn("button-secondary", showArchived && "border-blue-500 text-blue-700")} onClick={() => setShowArchived((value) => !value)}><Archive className="h-4 w-4" />{showArchived ? "Sembunyikan arsip" : "Lihat arsip"}</button></div>
      <div className="kanban-scroll overflow-x-auto pb-3"><div className="grid min-w-[1180px] grid-cols-5 gap-3">{columns.map((column) => {
        const columnTickets = tickets.filter(({ status }) => status === column.id);
        return <section key={column.id} className="rounded-2xl border border-line bg-ink/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.025]" onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, column.id)} aria-label={column.label}>
          <header className="mb-3 flex items-center gap-2 px-1"><span className={cn("h-2.5 w-2.5 rounded-full", column.tone)} /><h3 className="font-black">{column.label}</h3><span className="ml-auto rounded-full bg-ink/5 px-2 py-0.5 text-xs font-bold dark:bg-white/10">{columnTickets.length}</span></header>
          <div className="grid content-start gap-2">{columnTickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onEdit={() => { setEditingTicketId(ticket.id); setTicketForm(true); }} onMove={(direction) => { const index = columns.findIndex(({ id }) => id === ticket.status); const target = columns[index + direction]; if (target) move(ticket.id, target.id); }} />)}{columnTickets.length === 0 ? <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-line text-xs font-semibold text-ink/35 dark:border-white/10 dark:text-paper/35">Letakkan ticket di sini</div> : null}</div>
        </section>;
      })}</div></div>
    </> : null}

    {ticketForm && projectId ? <TicketEditor workspace={workspace} ticket={editingTicket} onSubmit={saveTicket} onClose={() => { setTicketForm(false); setEditingTicketId(null); }} onUpdate={updateTicket} onDelete={removeTicket} /> : null}
  </section>;
}

function TicketCard({ ticket, onEdit, onMove }: { ticket: KanbanTicket; onEdit: () => void; onMove: (direction: -1 | 1) => void }) {
  const checked = ticket.checklist.filter(({ done }) => done).length;
  const columnIndex = columns.findIndex(({ id }) => id === ticket.status);
  return <article draggable onDragStart={(event) => { event.dataTransfer.setData("text/ticket-id", ticket.id); event.dataTransfer.effectAllowed = "move"; }} className={cn("group rounded-xl border border-line bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-white/10 dark:bg-[#0b1f3a]", ticket.archived && "opacity-55")}>
    <div className="flex items-start gap-2"><GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-ink/25 dark:text-paper/25" /><button type="button" className="min-w-0 flex-1 text-left" onClick={onEdit}><p className="line-clamp-2 text-sm font-black leading-5">{ticket.title}</p></button><button type="button" onClick={onEdit} aria-label={`Ubah ${ticket.title}`}><Pencil className="h-3.5 w-3.5 text-ink/35 opacity-0 transition group-hover:opacity-100 dark:text-paper/35" /></button></div>
    <div className="mt-3 flex flex-wrap gap-1"><span className={cn("rounded-md px-2 py-1 text-[10px] font-black uppercase", priority(ticket.priority).className)}>{priority(ticket.priority).label}</span>{ticket.labels.slice(0, 2).map((label) => <span key={label} className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">{label}</span>)}</div>
    {ticket.dueDate || ticket.checklist.length || ticket.comments.length ? <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink/45 dark:text-paper/45">{ticket.dueDate ? <span className={cn("flex items-center gap-1", ticket.dueDate < new Date().toISOString().slice(0, 10) && ticket.status !== "done" && "text-red-600")}><CalendarDays className="h-3 w-3" />{ticket.dueDate.slice(5)}</span> : null}{ticket.checklist.length ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{checked}/{ticket.checklist.length}</span> : null}{ticket.comments.length ? <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket.comments.length}</span> : null}</div> : null}
    <div className="mt-3 flex justify-between border-t border-line pt-2 dark:border-white/10"><button type="button" aria-label={`Pindahkan ${ticket.title} ke kiri`} disabled={columnIndex === 0} onClick={() => onMove(-1)} className="rounded-md p-1 text-ink/40 enabled:hover:bg-blue-50 enabled:hover:text-blue-700 disabled:opacity-20 dark:text-paper/40"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label={`Pindahkan ${ticket.title} ke kanan`} disabled={columnIndex === columns.length - 1} onClick={() => onMove(1)} className="rounded-md p-1 text-ink/40 enabled:hover:bg-blue-50 enabled:hover:text-blue-700 disabled:opacity-20 dark:text-paper/40"><ChevronRight className="h-4 w-4" /></button></div>
  </article>;
}

function TicketEditor({ workspace, ticket, onSubmit, onClose, onUpdate, onDelete }: { workspace: OfflineWorkspace; ticket?: KanbanTicket; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void; onUpdate: (id: string, updater: (ticket: KanbanTicket) => KanbanTicket) => void; onDelete: (ticket: KanbanTicket) => void }) {
  function addChecklist(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!ticket) return; const data = new FormData(event.currentTarget); const value = String(data.get("check") || "").trim(); if (!value) return; onUpdate(ticket.id, (current) => ({ ...current, checklist: [...current.checklist, { id: id(), text: value, done: false }] })); event.currentTarget.reset(); }
  function addComment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!ticket) return; const data = new FormData(event.currentTarget); const value = String(data.get("comment") || "").trim(); if (!value) return; onUpdate(ticket.id, (current) => ({ ...current, comments: [...current.comments, { id: id(), body: value, createdAt: new Date().toISOString() }] })); event.currentTarget.reset(); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#061225]/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={ticket ? `Detail ${ticket.title}` : "Ticket baru"}><div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-paper p-5 text-ink shadow-2xl sm:p-7 dark:bg-[#071a35] dark:text-paper">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{ticket ? "Detail ticket" : "Ticket baru"}</p><h2 className="mt-1 text-2xl font-black">{ticket?.title ?? "Tambahkan pekerjaan"}</h2></div><button type="button" className="button-secondary h-10 w-10 p-0" onClick={onClose} aria-label="Tutup"><X className="h-4 w-4" /></button></div>
    <form key={ticket?.id ?? "new-ticket"} className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
      <label className="sm:col-span-2"><span className="label">Judul</span><input className="field mt-2" name="title" defaultValue={ticket?.title} maxLength={160} required autoFocus={!ticket} /></label>
      <label className="sm:col-span-2"><span className="label">Deskripsi</span><textarea className="field mt-2 min-h-24 resize-y" name="description" defaultValue={ticket?.description} maxLength={5000} /></label>
      <label><span className="label">Status</span><select className="field mt-2" name="status" defaultValue={ticket?.status ?? "backlog"}>{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></label>
      <label><span className="label">Prioritas</span><select className="field mt-2" name="priority" defaultValue={ticket?.priority ?? "medium"}>{priorities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label><span className="label">Label, pisahkan koma</span><input className="field mt-2" name="labels" defaultValue={ticket?.labels.join(", ")} placeholder="ui, rilis, bug" maxLength={300} /></label>
      <label><span className="label">Tenggat</span><input className="field mt-2" name="dueDate" type="date" defaultValue={ticket?.dueDate} /></label>
      <label><span className="label">Hubungkan agenda</span><select className="field mt-2" name="linkedScheduleId" defaultValue={ticket?.linkedScheduleId ?? ""}><option value="">Tidak ada</option>{workspace.schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.title}</option>)}</select></label>
      <label><span className="label">Hubungkan tujuan</span><select className="field mt-2" name="linkedGrowthGoalId" defaultValue={ticket?.linkedGrowthGoalId ?? ""}><option value="">Tidak ada</option>{workspace.growthGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="button-primary" type="submit">{ticket ? "Simpan perubahan" : "Buat ticket"}</button>{ticket ? <><button type="button" className="button-secondary" onClick={() => onUpdate(ticket.id, (current) => ({ ...current, archived: !current.archived }))}><Archive className="h-4 w-4" />{ticket.archived ? "Pulihkan" : "Arsipkan"}</button><button type="button" className="button-danger" onClick={() => onDelete(ticket)}><Trash2 className="h-4 w-4" />Hapus</button></> : null}</div>
    </form>
    {ticket ? <div className="mt-7 grid gap-5 border-t border-line pt-6 md:grid-cols-2 dark:border-white/10">
      <section><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-600" /><h3 className="font-black">Checklist</h3></div><form className="mt-3 flex gap-2" onSubmit={addChecklist}><input className="field" name="check" placeholder="Langkah kecil…" maxLength={240} /><button aria-label="Tambahkan checklist" className="button-primary px-3" type="submit"><Plus className="h-4 w-4" /></button></form><div className="mt-3 grid gap-2">{ticket.checklist.map((item) => <div className="flex items-start gap-2 rounded-xl border border-line p-3 dark:border-white/10" key={item.id}><button aria-label={`${item.done ? "Batalkan" : "Selesaikan"} ${item.text}`} type="button" onClick={() => onUpdate(ticket.id, (current) => ({ ...current, checklist: current.checklist.map((check) => check.id === item.id ? { ...check, done: !check.done } : check) }))}>{item.done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-ink/30" />}</button><span className={cn("min-w-0 flex-1 text-sm", item.done && "line-through opacity-50")}>{item.text}</span><button aria-label={`Hapus ${item.text}`} type="button" onClick={() => onUpdate(ticket.id, (current) => ({ ...current, checklist: current.checklist.filter(({ id }) => id !== item.id) }))}><Trash2 className="h-4 w-4 text-red-500" /></button></div>)}</div></section>
      <section><div className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-blue-600" /><h3 className="font-black">Komentar</h3></div><form className="mt-3 flex gap-2" onSubmit={addComment}><input className="field" name="comment" placeholder="Tambahkan catatan progres…" maxLength={2000} /><button aria-label="Tambahkan komentar" className="button-primary px-3" type="submit"><Plus className="h-4 w-4" /></button></form><div className="mt-3 grid gap-2">{[...ticket.comments].reverse().map((comment) => <article className="rounded-xl border border-line p-3 dark:border-white/10" key={comment.id}><p className="text-sm leading-6">{comment.body}</p><p className="mt-2 text-[10px] font-semibold text-ink/40 dark:text-paper/40">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.createdAt))}</p></article>)}</div></section>
    </div> : <p className="mt-5 rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-400/10 dark:text-blue-200">Simpan ticket terlebih dahulu untuk menambahkan checklist dan komentar.</p>}
  </div></div>;
}
