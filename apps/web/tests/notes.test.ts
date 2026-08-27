import { describe, expect, it } from "vitest";
import { formatNoteList, splitQuickNote } from "@/lib/notes";

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
