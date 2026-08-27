import "server-only";
import { createEmptyWorkspace, loadWorkspace, touchWorkspace, type OfflineWorkspace } from "@/lib/offline-workspace";
import { prisma } from "@/lib/prisma";

export type WorkspaceMergeConflict = { entityType: string; entityId: string; local: unknown; remote: unknown };

function stable(value: unknown) {
  return JSON.stringify(value, Object.keys((value && typeof value === "object" && !Array.isArray(value)) ? value as Record<string, unknown> : {}).sort());
}

function mergeArray<T extends { id: string }>(base: T[], local: T[], remote: T[], entityType: string, conflicts: WorkspaceMergeConflict[]) {
  const baseMap = new Map(base.map((item) => [item.id, item]));
  const localMap = new Map(local.map((item) => [item.id, item]));
  const remoteMap = new Map(remote.map((item) => [item.id, item]));
  const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  const result: T[] = [];
  for (const id of ids) {
    const baseItem = baseMap.get(id);
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);
    const localChanged = stable(localItem) !== stable(baseItem);
    const remoteChanged = stable(remoteItem) !== stable(baseItem);
    if (localChanged && remoteChanged && stable(localItem) !== stable(remoteItem)) {
      conflicts.push({ entityType, entityId: id, local: localItem ?? null, remote: remoteItem ?? null });
      if (remoteItem) result.push(remoteItem);
    } else if (localChanged) {
      if (localItem) result.push(localItem);
    } else if (remoteItem) {
      result.push(remoteItem);
    }
  }
  return result;
}

/** Merge each workspace record against the last synced base.
 * Different records are combined; the same record is returned as a conflict.
 */
export function mergeWorkspaceByRecord(base: OfflineWorkspace, local: OfflineWorkspace, remote: OfflineWorkspace) {
  const conflicts: WorkspaceMergeConflict[] = [];
  const arrayKeys = ["notes", "habits", "moneySources", "savingGoals", "recurringItems", "categoryGroups", "transactions", "schedules", "growthGoals", "focusSessions", "dailyReviews", "projects", "tickets", "checkIns", "priorities", "weeklyReviews", "weeklyQuests"] as const;
  const merged = { ...remote } as OfflineWorkspace;
  for (const key of arrayKeys) {
    merged[key] = mergeArray(base[key] as Array<{ id: string }>, local[key] as Array<{ id: string }>, remote[key] as Array<{ id: string }>, key, conflicts) as never;
  }
  const scalarKeys = ["cycle", "settings", "gamification"] as const;
  for (const key of scalarKeys) {
    const baseValue = base[key];
    const localValue = local[key];
    const remoteValue = remote[key];
    const localChanged = stable(localValue) !== stable(baseValue);
    const remoteChanged = stable(remoteValue) !== stable(baseValue);
    if (localChanged && remoteChanged && stable(localValue) !== stable(remoteValue)) conflicts.push({ entityType: key, entityId: key, local: localValue, remote: remoteValue });
    else if (localChanged) merged[key] = localValue as never;
  }
  return { workspace: touchWorkspace(merged), conflicts };
}

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
