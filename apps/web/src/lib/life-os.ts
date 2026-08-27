import type {
  DailyCheckIn,
  DailyPriority,
  GrowthArea,
  GrowthGoal,
  OfflineWorkspace,
  WorkspaceCycle,
  WeeklyQuest
} from "@/lib/offline-workspace";

export const LIFE_AREA_LABELS: Record<GrowthArea, string> = {
  career: "Karier",
  learning: "Belajar",
  health: "Kesehatan",
  finance: "Keuangan",
  personal: "Pribadi"
};

export function dayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

export function weekStart(value = new Date()) {
  const date = new Date(value);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dayKey(date);
}

export function createCycle(startDate = dayKey()) : WorkspaceCycle {
  return {
    id: `cycle-${startDate}`,
    name: "Siklus 1",
    startDate,
    endDate: addDays(startDate, 83),
    status: "active",
    copiedGoalIds: []
  };
}

export function todayCheckIn(workspace: OfflineWorkspace, date = dayKey()): DailyCheckIn {
  return workspace.checkIns.find((item) => item.date.slice(0, 10) === date) ?? { id: `checkin-${date}`, date };
}

export function updateCheckIn(workspace: OfflineWorkspace, patch: Partial<DailyCheckIn>, date = dayKey()): OfflineWorkspace {
  const current = todayCheckIn(workspace, date);
  const next = { ...current, ...patch, id: current.id, date };
  const exists = workspace.checkIns.some((item) => item.id === next.id);
  return { ...workspace, checkIns: exists ? workspace.checkIns.map((item) => item.id === next.id ? next : item) : [next, ...workspace.checkIns] };
}

function award(workspace: OfflineWorkspace, key: string, xp: number) {
  if (workspace.gamification.lastAwardKeys.includes(key)) return workspace;
  const next = {
    ...workspace.gamification,
    totalXp: workspace.gamification.totalXp + xp,
    lastAwardKeys: [...workspace.gamification.lastAwardKeys.slice(-4999), key]
  };
  return { ...workspace, gamification: next };
}

export function completeMorning(workspace: OfflineWorkspace, energy: number, date = dayKey()): OfflineWorkspace {
  let next = updateCheckIn(workspace, { morningCompletedAt: new Date().toISOString(), energy: Math.max(1, Math.min(5, Math.round(energy))) }, date);
  next = award(next, `morning:${date}`, 10);
  return refreshRitualStats(next);
}

export function completeEvening(workspace: OfflineWorkspace, values: Pick<DailyCheckIn, "win" | "lesson" | "nextStep" | "reflection">, date = dayKey()): OfflineWorkspace {
  let next = updateCheckIn(workspace, { ...values, eveningCompletedAt: new Date().toISOString() }, date);
  next = award(next, `evening:${date}`, 10);
  return refreshRitualStats(next);
}

export function completeHabitForXp(workspace: OfflineWorkspace, habitId: string, date = dayKey()): OfflineWorkspace {
  const dayAwards = workspace.gamification.lastAwardKeys.filter((key) => key.startsWith(`habit:${date}:`)).length;
  if (dayAwards >= 5) return workspace;
  return award(workspace, `habit:${date}:${habitId}`, 2);
}

export function completeWeeklyReviewForXp(workspace: OfflineWorkspace, week = weekStart()): OfflineWorkspace {
  return award(workspace, `weekly-review:${week}`, 30);
}

export function refreshRitualStats(workspace: OfflineWorkspace): OfflineWorkspace {
  const ritualDays = workspace.checkIns.filter((item) => Boolean(item.morningCompletedAt || item.eveningCompletedAt)).map((item) => item.date.slice(0, 10));
  const perfectDays = workspace.checkIns.filter((item) => Boolean(item.morningCompletedAt && item.eveningCompletedAt)).map((item) => item.date.slice(0, 10));
  return { ...workspace, gamification: { ...workspace.gamification, ritualDays: Array.from(new Set(ritualDays)).sort(), perfectDays: Array.from(new Set(perfectDays)).sort() } };
}

export function currentStreak(workspace: OfflineWorkspace, reference = new Date()) {
  const dates = new Set(workspace.gamification.ritualDays);
  let cursor = dayKey(reference);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function levelFromXp(totalXp: number) {
  return 1 + Math.floor(Math.max(0, totalXp) / 250);
}

export function goalEvidence(workspace: OfflineWorkspace, goal: GrowthGoal, range?: { start: string; end: string }) {
  const inRange = (date: string) => !range || (date.slice(0, 10) >= range.start && date.slice(0, 10) <= range.end);
  const priorities = workspace.priorities.filter((item) => item.link?.type === "goal" && item.link.id === goal.id && item.done && inRange(item.date)).length;
  const tickets = workspace.tickets.filter((item) => item.linkedGrowthGoalId === goal.id && item.status === "done" && inRange(item.updatedAt)).length;
  const schedules = workspace.schedules.filter((item) => item.linkedGrowthGoalId === goal.id && item.status === "completed" && inRange(item.date)).length;
  const habits = workspace.habits.filter((item) => item.linkedGrowthGoalId === goal.id).reduce((sum, item) => sum + item.completedDates.filter(inRange).length, 0);
  const focusMinutes = workspace.focusSessions.filter((item) => item.linkedGrowthGoalId === goal.id && inRange(item.date)).reduce((sum, item) => sum + item.minutes, 0);
  return { priorities, tickets, schedules, habits, focusMinutes, total: priorities + tickets + schedules + habits };
}

export function areaSummaries(workspace: OfflineWorkspace, cycleId = workspace.cycle.id) {
  return (Object.keys(LIFE_AREA_LABELS) as GrowthArea[]).map((area) => {
    const goals = workspace.growthGoals.filter((goal) => goal.area === area && (!goal.cycleId || goal.cycleId === cycleId));
    const evidence = goals.reduce((sum, goal) => sum + goalEvidence(workspace, goal).total, 0);
    return { area, label: LIFE_AREA_LABELS[area], goals: goals.length, progress: goals.length ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length) : 0, evidence };
  });
}

export function todayPriorities(workspace: OfflineWorkspace, date = dayKey()) {
  return workspace.priorities.filter((item) => item.date.slice(0, 10) === date).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 3);
}

export function upsertPriority(workspace: OfflineWorkspace, priority: DailyPriority): OfflineWorkspace {
  if (!workspace.priorities.some((item) => item.id === priority.id) && workspace.priorities.filter((item) => item.date.slice(0, 10) === priority.date.slice(0, 10)).length >= 3) return workspace;
  const priorities = workspace.priorities.some((item) => item.id === priority.id)
    ? workspace.priorities.map((item) => item.id === priority.id ? priority : item)
    : [priority, ...workspace.priorities];
  return { ...workspace, priorities };
}

export function upsertQuest(workspace: OfflineWorkspace, quest: WeeklyQuest): OfflineWorkspace {
  const current = workspace.weeklyQuests.filter((item) => item.weekStart === quest.weekStart);
  if (!workspace.weeklyQuests.some((item) => item.id === quest.id) && current.length >= 3) return workspace;
  return { ...workspace, weeklyQuests: workspace.weeklyQuests.some((item) => item.id === quest.id) ? workspace.weeklyQuests.map((item) => item.id === quest.id ? quest : item) : [quest, ...workspace.weeklyQuests] };
}

export function closeCycle(workspace: OfflineWorkspace, selectedGoalIds: string[], nextStart = dayKey()): OfflineWorkspace {
  const nextCycle = createCycle(nextStart);
  const nextGoals = workspace.growthGoals.filter((goal) => selectedGoalIds.includes(goal.id)).map((goal) => ({ ...goal, id: `goal-${crypto.randomUUID()}`, cycleId: nextCycle.id, progress: 0, createdAt: new Date().toISOString() }));
  return { ...workspace, cycle: { ...nextCycle, name: `Siklus berikutnya` }, growthGoals: [...nextGoals, ...workspace.growthGoals] };
}
