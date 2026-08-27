import "server-only";
import { createEmptyWorkspace, loadWorkspace, touchWorkspace, type OfflineWorkspace } from "@/lib/offline-workspace";
import { prisma } from "@/lib/prisma";
export { mergeWorkspaceByRecord, type WorkspaceMergeConflict } from "@/lib/workspace-merge";

export async function readCentralWorkspace(userId: string) {
  const snapshot = await prisma.workspaceSnapshot.findUnique({ where: { userId } });
  return { data: snapshot ? loadWorkspace(JSON.stringify(snapshot.data)) : createEmptyWorkspace(), revision: snapshot?.revision ?? 0 };
}

export async function mutateCentralWorkspace(userId: string, mutate: (workspace: OfflineWorkspace) => OfflineWorkspace) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await prisma.workspaceSnapshot.findUnique({ where: { userId } });
    const workspace = touchWorkspace(mutate(current ? loadWorkspace(JSON.stringify(current.data)) : createEmptyWorkspace()));
    const data = JSON.parse(JSON.stringify(workspace));
    if (current) {
      const saved = await prisma.workspaceSnapshot.updateMany({ where: { userId, revision: current.revision }, data: { data, revision: { increment: 1 } } });
      if (saved.count) return workspace;
      continue;
    }
    try {
      await prisma.workspaceSnapshot.create({ data: { userId, data, revision: 1 } });
      return workspace;
    } catch {
      // Perangkat lain membuat snapshot lebih dulu; baca ulang dan coba lagi.
    }
  }
  throw new Error("Workspace sedang berubah. Coba lagi.");
}

export async function writeCentralWorkspace(userId: string, workspace: OfflineWorkspace, revision: number) {
  const data = JSON.parse(JSON.stringify(touchWorkspace(workspace)));
  const saved = await prisma.workspaceSnapshot.updateMany({ where: { userId, revision }, data: { data, revision: { increment: 1 } } });
  if (!saved.count) throw new Error("WORKSPACE_CONFLICT");
}
