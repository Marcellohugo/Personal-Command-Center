import { touchWorkspace, type OfflineWorkspace } from "@/lib/offline-workspace";

export type WorkspaceMergeConflict = { entityType: string; entityId: string; local: unknown; remote: unknown };

function stable(value: unknown) {
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonical(child)]));
  };
  return JSON.stringify(canonical(value));
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
    } else if (remoteItem) result.push(remoteItem);
  }
  return result;
}

/** Merge each workspace record against the last synced base. */
export function mergeWorkspaceByRecord(base: OfflineWorkspace, local: OfflineWorkspace, remote: OfflineWorkspace) {
  const conflicts: WorkspaceMergeConflict[] = [];
  const arrayKeys = ["notes", "noteTemplates", "savedNoteSearches", "habits", "moneySources", "savingGoals", "recurringItems", "categoryGroups", "transactions", "budgetPlans", "investments", "reconciliations", "financialAudit", "schedules", "growthGoals", "focusSessions", "dailyReviews", "projects", "tickets", "checkIns", "priorities", "weeklyReviews", "weeklyQuests"] as const;
  const merged = { ...remote } as OfflineWorkspace;
  for (const key of arrayKeys) merged[key] = mergeArray(base[key] as Array<{ id: string }>, local[key] as Array<{ id: string }>, remote[key] as Array<{ id: string }>, key, conflicts) as never;
  for (const key of ["cycle", "settings", "gamification"] as const) {
    const localChanged = stable(local[key]) !== stable(base[key]);
    const remoteChanged = stable(remote[key]) !== stable(base[key]);
    if (localChanged && remoteChanged && stable(local[key]) !== stable(remote[key])) conflicts.push({ entityType: key, entityId: key, local: local[key], remote: remote[key] });
    else if (localChanged) merged[key] = local[key] as never;
  }
  return { workspace: touchWorkspace(merged), conflicts };
}
