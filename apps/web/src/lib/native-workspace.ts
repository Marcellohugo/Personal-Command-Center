import { createEmptyWorkspace, loadWorkspace, type DailyCheckIn, type DailyPriority, type GamificationState, type KanbanTicket, type OfflineWorkspace, type ProjectBoard, type WorkspaceCycle, type WeeklyQuest, type WeeklyReview } from "@/lib/offline-workspace";

export type NativeWorkspace = {
  version: 1 | 2 | 3 | 4 | 5;
  transactions: Array<{ id: string; title: string; amount: number; isIncome: boolean; date: string }>;
  agenda: Array<{ id: string; title: string; date: string; isDone: boolean }>;
  notes: Array<{ id: string; title: string; body: string; updatedAt: string }>;
  habits: Array<{ id: string; name: string; completedDates: string[] }>;
  growthGoals: Array<{ id: string; title: string; area: "career" | "learning" | "health" | "finance" | "personal"; progress: number; targetDate: string; nextAction: string; createdAt: string }>;
  focusSessions: Array<{ id: string; title: string; area: "career" | "learning" | "health" | "finance" | "personal"; minutes: number; date: string; note: string }>;
  dailyReviews: Array<{ id: string; date: string; mood: number; energy: number; win: string; lesson: string; nextStep: string }>;
  projects: ProjectBoard[];
  tickets: KanbanTicket[];
  settings: { monthlyBudget: number; hideBalances: boolean };
  lifeOs?: { cycle: WorkspaceCycle; checkIns: DailyCheckIn[]; priorities: DailyPriority[]; weeklyReviews: WeeklyReview[]; weeklyQuests: WeeklyQuest[]; gamification: GamificationState };
};

const growthAreas = ["career", "learning", "health", "finance", "personal"] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown, limit: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : null;
}

function date(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function amount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1_000_000_000_000_000
    ? value
    : null;
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.slice(0, 10_000).filter(record) : null;
}

export function normalizeNativeWorkspace(value: unknown): NativeWorkspace | null {
  if (!record(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4 && value.version !== 5)) return null;
  const transactions = rows(value.transactions);
  const agenda = rows(value.agenda);
  const notes = rows(value.notes);
  const habits = rows(value.habits);
  const growthGoals = value.version >= 3 ? rows(value.growthGoals) : [];
  const focusSessions = value.version >= 3 ? rows(value.focusSessions) : [];
  const dailyReviews = value.version >= 3 ? rows(value.dailyReviews) : [];
  const projects = value.version >= 4 ? rows(value.projects) : [];
  const tickets = value.version >= 4 ? rows(value.tickets) : [];
  if (!transactions || !agenda || !notes || !habits || !growthGoals || !focusSessions || !dailyReviews || !projects || !tickets) return null;

  const normalizedTransactions = transactions.map((item) => ({
    id: text(item.id, 128),
    title: text(item.title, 160),
    amount: amount(item.amount),
    isIncome: item.isIncome === true,
    date: date(item.date)
  }));
  const normalizedAgenda = agenda.map((item) => ({
    id: text(item.id, 128),
    title: text(item.title, 160),
    date: date(item.date),
    isDone: item.isDone === true
  }));
  const normalizedNotes = notes.map((item) => ({
    id: text(item.id, 128),
    title: text(item.title, 160),
    body: typeof item.body === "string" ? item.body.slice(0, 200_000) : "",
    updatedAt: date(item.updatedAt)
  }));
  const normalizedHabits = habits.map((item) => ({
    id: text(item.id, 128),
    name: text(item.name, 160),
    completedDates: Array.isArray(item.completedDates)
      ? Array.from(new Set(item.completedDates.filter((entry): entry is string => typeof entry === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry)))).slice(0, 3660).sort()
      : []
  }));
  const normalizedGrowthGoals = growthGoals.map((item) => ({
    id: text(item.id, 128),
    title: text(item.title, 160),
    area: typeof item.area === "string" && growthAreas.includes(item.area as typeof growthAreas[number]) ? item.area as typeof growthAreas[number] : "personal" as const,
    progress: typeof item.progress === "number" && Number.isFinite(item.progress) ? Math.max(0, Math.min(100, Math.round(item.progress))) : 0,
    targetDate: typeof item.targetDate === "string" && item.targetDate && !Number.isNaN(Date.parse(item.targetDate)) ? item.targetDate.slice(0, 10) : "",
    nextAction: typeof item.nextAction === "string" ? item.nextAction.trim().slice(0, 240) : "",
    createdAt: date(item.createdAt)
  }));
  const normalizedFocusSessions = focusSessions.map((item) => ({
    id: text(item.id, 128),
    title: text(item.title, 160),
    area: typeof item.area === "string" && growthAreas.includes(item.area as typeof growthAreas[number]) ? item.area as typeof growthAreas[number] : "personal" as const,
    minutes: typeof item.minutes === "number" && Number.isFinite(item.minutes) ? Math.max(1, Math.min(1440, Math.round(item.minutes))) : null,
    date: date(item.date),
    note: typeof item.note === "string" ? item.note.trim().slice(0, 1000) : ""
  }));
  const normalizedDailyReviews = dailyReviews.map((item) => ({
    id: text(item.id, 128),
    date: date(item.date),
    mood: typeof item.mood === "number" && Number.isFinite(item.mood) ? Math.max(1, Math.min(5, Math.round(item.mood))) : 3,
    energy: typeof item.energy === "number" && Number.isFinite(item.energy) ? Math.max(1, Math.min(5, Math.round(item.energy))) : 3,
    win: typeof item.win === "string" ? item.win.trim().slice(0, 1000) : "",
    lesson: typeof item.lesson === "string" ? item.lesson.trim().slice(0, 1000) : "",
    nextStep: typeof item.nextStep === "string" ? item.nextStep.trim().slice(0, 1000) : ""
  }));
  const normalizedProjects = projects.map((item) => ({
    id: text(item.id, 128),
    name: text(item.name, 120),
    description: typeof item.description === "string" ? item.description.trim().slice(0, 1000) : "",
    color: typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : "#2563eb",
    archived: item.archived === true,
    createdAt: date(item.createdAt)
  }));
  const statuses = ["backlog", "ready", "in_progress", "review", "done"] as const;
  const priorities = ["low", "medium", "high", "urgent"] as const;
  const normalizedTickets = tickets.map((item) => ({
    id: text(item.id, 128),
    projectId: text(item.projectId, 128),
    title: text(item.title, 160),
    description: typeof item.description === "string" ? item.description.slice(0, 5000) : "",
    status: typeof item.status === "string" && statuses.includes(item.status as typeof statuses[number]) ? item.status as typeof statuses[number] : "backlog" as const,
    priority: typeof item.priority === "string" && priorities.includes(item.priority as typeof priorities[number]) ? item.priority as typeof priorities[number] : "medium" as const,
    labels: Array.isArray(item.labels) ? Array.from(new Set(item.labels.filter((label): label is string => typeof label === "string" && Boolean(label.trim())).map((label) => label.trim().slice(0, 30)))).slice(0, 10) : [],
    dueDate: typeof item.dueDate === "string" && item.dueDate && !Number.isNaN(Date.parse(item.dueDate)) ? item.dueDate.slice(0, 10) : "",
    checklist: (rows(item.checklist) ?? []).filter((entry) => Boolean(text(entry.id, 128) && text(entry.text, 240))).slice(0, 100).map((entry) => ({ id: text(entry.id, 128)!, text: text(entry.text, 240)!, done: entry.done === true })),
    comments: (rows(item.comments) ?? []).filter((entry) => Boolean(text(entry.id, 128) && typeof entry.body === "string" && entry.body.trim() && date(entry.createdAt))).slice(0, 200).map((entry) => ({ id: text(entry.id, 128)!, body: (entry.body as string).trim().slice(0, 2000), createdAt: date(entry.createdAt)! })),
    linkedScheduleId: typeof item.linkedScheduleId === "string" ? item.linkedScheduleId.slice(0, 128) : undefined,
    linkedGrowthGoalId: typeof item.linkedGrowthGoalId === "string" ? item.linkedGrowthGoalId.slice(0, 128) : undefined,
    archived: item.archived === true,
    order: typeof item.order === "number" && Number.isFinite(item.order) ? Math.max(0, Math.round(item.order)) : 0,
    createdAt: date(item.createdAt),
    updatedAt: date(item.updatedAt)
  }));
  if (normalizedTransactions.some((item) => !item.id || !item.title || !item.amount || !item.date)
    || normalizedAgenda.some((item) => !item.id || !item.title || !item.date)
    || normalizedNotes.some((item) => !item.id || !item.title || !item.updatedAt)
    || normalizedHabits.some((item) => !item.id || !item.name)
    || normalizedGrowthGoals.some((item) => !item.id || !item.title || !item.createdAt)
    || normalizedFocusSessions.some((item) => !item.id || !item.title || !item.minutes || !item.date)
    || normalizedDailyReviews.some((item) => !item.id || !item.date)
    || normalizedProjects.some((item) => !item.id || !item.name || !item.createdAt)
    || normalizedTickets.some((item) => !item.id || !item.projectId || !item.title || !item.createdAt || !item.updatedAt)) return null;

  const settings = record(value.settings) ? value.settings : {};
  const lifeWorkspace = record(value.lifeOs) ? loadWorkspace(JSON.stringify({ version: 5, ...value.lifeOs })) : null;
  return {
    version: value.version,
    transactions: normalizedTransactions as NativeWorkspace["transactions"],
    agenda: normalizedAgenda as NativeWorkspace["agenda"],
    notes: normalizedNotes as NativeWorkspace["notes"],
    habits: normalizedHabits as NativeWorkspace["habits"],
    growthGoals: normalizedGrowthGoals as NativeWorkspace["growthGoals"],
    focusSessions: normalizedFocusSessions as NativeWorkspace["focusSessions"],
    dailyReviews: normalizedDailyReviews as NativeWorkspace["dailyReviews"],
    projects: normalizedProjects as NativeWorkspace["projects"],
    tickets: normalizedTickets as NativeWorkspace["tickets"],
    settings: {
      monthlyBudget: typeof settings.monthlyBudget === "number" && Number.isFinite(settings.monthlyBudget)
        ? Math.max(0, Math.min(settings.monthlyBudget, 1_000_000_000_000_000))
        : 0,
      hideBalances: settings.hideBalances === true
    },
    lifeOs: lifeWorkspace ? { cycle: lifeWorkspace.cycle, checkIns: lifeWorkspace.checkIns, priorities: lifeWorkspace.priorities, weeklyReviews: lifeWorkspace.weeklyReviews, weeklyQuests: lifeWorkspace.weeklyQuests, gamification: lifeWorkspace.gamification } : undefined
  };
}

export function nativeFromWorkspace(workspace: OfflineWorkspace): NativeWorkspace {
  return {
    version: 5,
    transactions: workspace.transactions.filter(({ kind }) => kind !== "transfer").map((item) => ({
      id: item.id,
      title: item.note || (item.kind === "income" ? "Pemasukan" : "Pengeluaran"),
      amount: item.amount,
      isIncome: item.kind === "income",
      date: item.date
    })),
    agenda: workspace.schedules.map((item) => ({
      id: item.id,
      title: item.title,
      date: item.date,
      isDone: item.status === "completed"
    })),
    notes: workspace.notes.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.content,
      updatedAt: item.updatedAt
    })),
    habits: workspace.habits.map((item) => ({
      id: item.id,
      name: item.name,
      completedDates: item.completedDates
    })),
    growthGoals: workspace.growthGoals,
    focusSessions: workspace.focusSessions,
    dailyReviews: workspace.dailyReviews,
    projects: workspace.projects,
    tickets: workspace.tickets,
    settings: {
      monthlyBudget: workspace.settings.monthlyBudget,
      hideBalances: workspace.settings.hideBalances
    },
    lifeOs: { cycle: workspace.cycle, checkIns: workspace.checkIns, priorities: workspace.priorities, weeklyReviews: workspace.weeklyReviews, weeklyQuests: workspace.weeklyQuests, gamification: workspace.gamification }
  };
}

export function mergeNativeWorkspace(native: NativeWorkspace, current: OfflineWorkspace | null): OfflineWorkspace {
  const workspace = current ?? createEmptyWorkspace();
  const transactions = new Map(workspace.transactions.map((item) => [item.id, item]));
  const schedules = new Map(workspace.schedules.map((item) => [item.id, item]));
  const notes = new Map(workspace.notes.map((item) => [item.id, item]));
  const habits = new Map(workspace.habits.map((item) => [item.id, item]));

  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    transactions: [
      ...workspace.transactions.filter(({ kind }) => kind === "transfer"),
      ...native.transactions.map((item) => ({
        ...transactions.get(item.id),
        id: item.id,
        kind: item.isIncome ? "income" as const : "expense" as const,
        amount: item.amount,
        date: item.date.slice(0, 10),
        sourceId: transactions.get(item.id)?.sourceId ?? "",
        note: item.title,
        createdAt: transactions.get(item.id)?.createdAt ?? new Date().toISOString()
      }))
    ],
    schedules: native.agenda.map((item) => ({
      ...schedules.get(item.id),
      id: item.id,
      title: item.title,
      description: schedules.get(item.id)?.description ?? "",
      date: item.date.slice(0, 10),
      startTime: schedules.get(item.id)?.startTime ?? "09:00",
      status: item.isDone ? "completed" as const : "planned" as const,
      recurrence: schedules.get(item.id)?.recurrence ?? "none" as const
    })),
    notes: native.notes.map((item) => ({
      ...notes.get(item.id),
      id: item.id,
      title: item.title,
      content: item.body,
      pinned: notes.get(item.id)?.pinned ?? false,
      updatedAt: item.updatedAt
    })),
    habits: native.habits.map((item) => ({
      ...habits.get(item.id),
      id: item.id,
      name: item.name,
      frequency: habits.get(item.id)?.frequency ?? "daily" as const,
      completedDates: item.completedDates,
      createdAt: habits.get(item.id)?.createdAt ?? new Date().toISOString()
    })),
    growthGoals: native.version >= 3 ? native.growthGoals : workspace.growthGoals,
    focusSessions: native.version >= 3 ? native.focusSessions : workspace.focusSessions,
    dailyReviews: native.version >= 3 ? native.dailyReviews : workspace.dailyReviews,
    projects: native.version >= 4 ? native.projects : workspace.projects,
    tickets: native.version >= 4 ? native.tickets : workspace.tickets,
    settings: {
      ...workspace.settings,
      monthlyBudget: native.settings.monthlyBudget,
      hideBalances: native.settings.hideBalances
    },
    ...(native.lifeOs ? native.lifeOs : {})
  };
}
