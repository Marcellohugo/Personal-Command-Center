import { describe, expect, it } from "vitest";
import { builtInNoteTemplates, extractNoteTasks, formatNoteList, noteFromTemplate, relatedNotes, searchNotes, splitQuickNote, withNoteVersion } from "@/lib/notes";

describe("formatNoteList", () => {
  it("formats selected lines and replaces an existing list style", () => {
    const text = "• satu\n• dua";

    expect(formatNoteList(text, 0, text.length, "numbered")).toEqual({
      value: "1. satu\n2. dua",
      selectionStart: 0,
      selectionEnd: 14
    });
  });
});

describe("splitQuickNote", () => {
  it("uses the first line as title and preserves the remaining content", () => {
    expect(splitQuickNote("Tugas akhir:\n• Jalankan database\n• Buat dokumentasi")).toEqual({
      title: "Tugas akhir:",
      content: "• Jalankan database\n• Buat dokumentasi"
    });
    expect(splitQuickNote("   ")).toBeNull();
  });
});

describe("advanced notes", () => {
  it("membuat jurnal, versi, pencarian, tugas, dan catatan terkait", () => {
    const draft = noteFromTemplate(builtInNoteTemplates[0], new Date("2026-08-27T12:00:00"));
    expect(draft).toMatchObject({ title: "Jurnal 2026-08-27", journalDate: "2026-08-27" });
    const previous = { id: "a", title: "Belajar", content: "☐ Uji fitur", pinned: false, updatedAt: "2026-08-27T00:00:00Z", tags: ["produk"] };
    const current = withNoteVersion(previous, { ...previous, content: "☐ Uji fitur\nHasil baik", updatedAt: "2026-08-27T01:00:00Z" });
    expect(current.versions).toHaveLength(1);
    expect(extractNoteTasks(current)).toEqual(["Uji fitur"]);
    const related = { id: "b", title: "Produk", content: "Belajar produk baru", pinned: false, updatedAt: "2026-08-27T02:00:00Z", tags: ["produk"] };
    expect(relatedNotes([current, related], current)[0].id).toBe("b");
    expect(searchNotes([current, related], { query: "hasil", status: "active" })[0].id).toBe("a");
  });
});
