export type NoteListStyle = "bullet" | "numbered" | "checklist";

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
