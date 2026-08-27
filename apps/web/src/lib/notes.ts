import type { Note, NoteTemplate, OfflineWorkspace, SavedNoteSearch, WorkspaceEntityLink } from "@/lib/offline-workspace";

export type NoteListStyle = "bullet" | "numbered" | "checklist";

export const builtInNoteTemplates: NoteTemplate[] = [
  { id: "daily-journal", name: "Jurnal harian", title: "Jurnal {{date}}", folder: "Jurnal", tags: ["jurnal"], content: "## Kondisi hari ini\n\n## Tiga prioritas\n☐ \n☐ \n☐ \n\n## Refleksi\n\n## Satu langkah besok\n" },
  { id: "weekly-finance", name: "Review keuangan mingguan", title: "Review keuangan {{date}}", folder: "Keuangan", tags: ["review", "keuangan"], content: "## Yang berjalan baik\n\n## Pengeluaran yang perlu diperhatikan\n\n## Tagihan mendatang\n\n## Keputusan minggu depan\n☐ \n" },
  { id: "meeting", name: "Catatan rapat", title: "Rapat — ", folder: "Kerja", tags: ["rapat"], content: "## Tujuan\n\n## Poin penting\n\n## Keputusan\n\n## Tindak lanjut\n☐ \n" },
  { id: "learning", name: "Catatan belajar", title: "Belajar — ", folder: "Belajar", tags: ["belajar"], content: "## Konsep\n\n## Penjelasan dengan kata sendiri\n\n## Contoh\n\n## Pertanyaan berikutnya\n" },
  { id: "decision", name: "Catatan keputusan", title: "Keputusan — ", folder: "Keputusan", tags: ["keputusan"], content: "## Konteks\n\n## Pilihan\n\n## Keputusan\n\n## Alasan\n\n## Tanggal evaluasi\n" }
];

export function splitQuickNote(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [firstLine, ...content] = trimmed.split("\n");
  return {
    title: firstLine.replace(/^[•☐☑-]\s*/, "").slice(0, 120) || "Note",
    content: content.join("\n").trim()
  };
}

export function formatNoteList(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  style: NoteListStyle
) {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const lineStart = start === 0 ? 0 : text.lastIndexOf("\n", start - 1) + 1;
  const selectionLineEnd = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const nextLineBreak = text.indexOf("\n", selectionLineEnd);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const formatted = text
    .slice(lineStart, lineEnd)
    .split("\n")
    .map((line, index) => {
      const content = line.replace(/^(?:[•*-] |\d+\. |☐ )/, "");
      const prefix = style === "bullet" ? "• " : style === "checklist" ? "☐ " : `${index + 1}. `;
      return `${prefix}${content}`;
    })
    .join("\n");

  return {
    value: `${text.slice(0, lineStart)}${formatted}${text.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + formatted.length
  };
}

export function noteFromTemplate(template: NoteTemplate, now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    title: template.title.replaceAll("{{date}}", date),
    content: template.content.replaceAll("{{date}}", date),
    folder: template.folder ?? "",
    tags: template.tags ?? [],
    templateId: template.id,
    journalDate: template.id === "daily-journal" ? date : undefined
  };
}

export function withNoteVersion(previous: Note | undefined, next: Note): Note {
  if (!previous || (previous.title === next.title && previous.content === next.content)) return next;
  return {
    ...next,
    versions: [...(previous.versions ?? []), { id: crypto.randomUUID(), title: previous.title, content: previous.content, updatedAt: previous.updatedAt }].slice(-20)
  };
}

function normalizedWords(value: string) {
  return new Set(value.toLocaleLowerCase("id-ID").replace(/[^a-z0-9\p{L}\s]/gu, " ").split(/\s+/).filter((word) => word.length > 3));
}

export function relatedNotes(notes: Note[], note: Note, limit = 5) {
  const source = normalizedWords(`${note.title} ${note.content} ${(note.tags ?? []).join(" ")}`);
  return notes.filter((item) => item.id !== note.id && (item.status ?? "active") === "active").map((item) => {
    const words = normalizedWords(`${item.title} ${item.content} ${(item.tags ?? []).join(" ")}`);
    const score = [...source].filter((word) => words.has(word)).length + (item.tags ?? []).filter((tag) => note.tags?.includes(tag)).length * 3;
    return { note: item, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ note: item }) => item);
}

export function noteBacklinks(notes: Note[], noteId: string) {
  return notes.filter((note) => note.links?.some((link) => link.type === "note" && link.id === noteId));
}

export function entityLabel(workspace: OfflineWorkspace, link: WorkspaceEntityLink) {
  if (link.type === "note") return workspace.notes.find(({ id }) => id === link.id)?.title;
  if (link.type === "schedule") return workspace.schedules.find(({ id }) => id === link.id)?.title;
  if (link.type === "transaction") return workspace.transactions.find(({ id }) => id === link.id)?.note || "Transaksi";
  if (link.type === "savingGoal") return workspace.savingGoals.find(({ id }) => id === link.id)?.name;
  if (link.type === "growthGoal") return workspace.growthGoals.find(({ id }) => id === link.id)?.title;
  if (link.type === "habit") return workspace.habits.find(({ id }) => id === link.id)?.name;
  if (link.type === "ticket") return workspace.tickets.find(({ id }) => id === link.id)?.title;
  return workspace.projects.find(({ id }) => id === link.id)?.name;
}

export function searchNotes(notes: Note[], search: Pick<SavedNoteSearch, "query" | "folder" | "tag" | "status">) {
  const query = search.query.trim().toLocaleLowerCase("id-ID");
  return notes.filter((note) => {
    if ((note.status ?? "active") !== (search.status ?? "active")) return false;
    if (search.folder && note.folder !== search.folder) return false;
    if (search.tag && !note.tags?.includes(search.tag)) return false;
    const haystack = `${note.title} ${note.content} ${(note.tags ?? []).join(" ")} ${note.folder ?? ""} ${(note.attachments ?? []).map((item) => item.extractedText ?? "").join(" ")}`.toLocaleLowerCase("id-ID");
    return !query || haystack.includes(query) || [...normalizedWords(query)].every((word) => normalizedWords(haystack).has(word));
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function extractNoteTasks(note: Note) {
  return note.content.split("\n").map((line) => line.trim()).filter((line) => /^(?:☐|\[ \]|- \[ \])\s*/.test(line)).map((line) => line.replace(/^(?:☐|\[ \]|- \[ \])\s*/, "").trim()).filter(Boolean);
}

export function noteSummary(note: Note, length = 180) {
  const text = note.content.replace(/^#{1,6}\s+/gm, "").replace(/^(?:[•*-]|\d+\.|☐|☑)\s+/gm, "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

export function exportNotesMarkdown(notes: Note[]) {
  return notes.filter((note) => (note.status ?? "active") !== "trashed").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((note) => [
    `# ${note.title}`,
    "",
    note.folder ? `Folder: ${note.folder}` : "",
    note.tags?.length ? `Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}` : "",
    `Diperbarui: ${note.updatedAt}`,
    "",
    note.content,
    "",
    "---",
    ""
  ].filter((line, index, rows) => line || rows[index - 1] !== "").join("\n")).join("\n");
}
