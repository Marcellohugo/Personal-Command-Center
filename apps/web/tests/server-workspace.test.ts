import { describe, expect, it } from "vitest";
import { createEmptyWorkspace } from "@/lib/offline-workspace";
import { mergeWorkspaceByRecord } from "@/lib/workspace-merge";

describe("record-level workspace merge", () => {
  it("menggabungkan record berbeda dan mendeteksi perubahan nested pada record sama", () => {
    const base = createEmptyWorkspace();
    base.notes = [
      { id: "a", title: "A", content: "awal", pinned: false, updatedAt: "2026-08-01T00:00:00Z", links: [] },
      { id: "b", title: "B", content: "awal", pinned: false, updatedAt: "2026-08-01T00:00:00Z" }
    ];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.notes[0].links = [{ type: "habit", id: "water" }];
    remote.notes[0].links = [{ type: "ticket", id: "task" }];
    remote.notes[1].content = "remote";

    const result = mergeWorkspaceByRecord(base, local, remote);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({ entityType: "notes", entityId: "a" });
    expect(result.workspace.notes.find(({ id }) => id === "b")?.content).toBe("remote");
  });
});
