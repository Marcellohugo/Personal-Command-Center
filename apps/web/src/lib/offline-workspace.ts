export const WORKSPACE_STORAGE_KEY = "marco-life-os-workspace-v5";
export const LEGACY_WORKSPACE_STORAGE_KEY = "personal-command-center-workspace-v1";
export const WORKSPACE_SYNC_KEY = "personal-command-center-sync-v1";
export const WORKSPACE_GENERATION_KEY = "marco-life-os-generation-v1";

export type WorkspaceAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  dataUrl?: string;
  url?: string;
  extractedText?: string;
};

export type WorkspaceEntityType = "note" | "schedule" | "transaction" | "savingGoal" | "growthGoal" | "habit" | "ticket" | "project";
export type WorkspaceEntityLink = { type: WorkspaceEntityType; id: string };
export type NoteVersion = { id: string; title: string; content: string; updatedAt: string };

export type Note = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  updatedAt: string;
  folder?: string;
  tags?: string[];
  linkedScheduleId?: string;
  status?: "active" | "archived" | "trashed";
  deletedAt?: string;
  journalDate?: string;
  templateId?: string;
  reminderAt?: string;
  versions?: NoteVersion[];
  attachments?: WorkspaceAttachment[];
  links?: WorkspaceEntityLink[];
};

export type NoteTemplate = {
  id: string;
  name: string;
  title: string;
  content: string;
  folder?: string;
  tags?: string[];
};

export type SavedNoteSearch = {
  id: string;
  name: string;
  query: string;
  folder?: string;
  tag?: string;
  status?: "active" | "archived" | "trashed";
};

export type WorkspaceHabit = {
  id: string;
  name: string;
  frequency: "daily" | "weekly";
  completedDates: string[];
  createdAt: string;
  linkedGrowthGoalId?: string;
};

export type MoneySourceType =
  | "cash"
  | "deposit_card"
  | "virtual_account"
  | "credit_card"
  | "investment"
  | "receivable"
  | "debt";

export type MoneySource = {
  id: string;
  name: string;
  type: MoneySourceType;
  balance: number;
  dueDate?: string;
  installmentAmount?: number;
  paymentSourceId?: string;
  institution?: string;
  accountLast4?: string;
  currency?: string;
  openingBalance?: number;
  annualInterestRate?: number;
  minimumPayment?: number;
  originalPrincipal?: number;
  termMonths?: number;
  statementDay?: number;
};

export type GoalMovement = {
  id: string;
  kind: "deposit" | "withdrawal";
  amount: number;
  date: string;
};

export type SavingGoal = {
  id: string;
  name: string;
  mode: "flexible" | "cycle";
  target: number;
  saved: number;
  cycle: "weekly" | "monthly";
  sourceId?: string;
  autoAmount?: number;
  nextContributionDate?: string;
  movements?: GoalMovement[];
};

export type RecurringItem = {
  id: string;
  name: string;
  kind: "payment" | "transfer";
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  nextDate: string;
  sourceId: string;
  destination: string;
  destinationSourceId?: string;
  categoryId?: string;
  autoPost?: boolean;
  lastPaidDate?: string;
};

export type CategoryGroup = {
  id: string;
  name: string;
  kind: "expense" | "income";
  monthlyBudget?: number;
  keywords?: string[];
};

export type BudgetPlan = {
  id: string;
  month: string;
  categoryId: string;
  planned: number;
  rollover?: number;
  note?: string;
};

export type TransactionSplit = { id: string; amount: number; categoryId?: string; note?: string };

export type Transaction = {
  id: string;
  kind: "expense" | "income" | "transfer";
  amount: number;
  date: string;
  sourceId: string;
  destinationSourceId?: string;
  destinationGoalId?: string;
  sourceGoalId?: string;
  categoryId?: string;
  note: string;
  recurringItemId?: string;
  goalMovementId?: string;
  createdAt: string;
  updatedAt?: string;
  payee?: string;
  status?: "pending" | "cleared" | "reconciled";
  externalId?: string;
  clearedAt?: string;
  reconciledAt?: string;
  linkedNoteId?: string;
  splits?: TransactionSplit[];
  receiptAttachments?: WorkspaceAttachment[];
};

export type InvestmentHolding = {
  id: string;
  name: string;
  symbol?: string;
  kind: "stock" | "fund" | "crypto" | "bond" | "gold" | "other";
  sourceId?: string;
  units: number;
  costBasis: number;
  currentPrice: number;
  dividends?: number;
  updatedAt: string;
};

export type ReconciliationRecord = {
  id: string;
  sourceId: string;
  statementDate: string;
  statementBalance: number;
  workspaceBalance: number;
  difference: number;
  note?: string;
  createdAt: string;
};

export type FinancialAuditEntry = {
  id: string;
  action: "create" | "update" | "delete" | "import" | "reconcile" | "lock" | "unlock";
  entityId: string;
  summary: string;
  occurredAt: string;
};

export type WorkspaceSchedule = {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  status: "planned" | "completed" | "cancelled";
  recurrence: "none" | "daily" | "weekly" | "monthly";
  reminderMinutes?: number;
  linkedNoteId?: string;
  linkedGrowthGoalId?: string;
  googleEventId?: string;
  source?: "manual" | "google_calendar";
};

export type WorkspaceSettings = {
  monthlyBudget: number;
  hideBalances: boolean;
  notificationsEnabled: boolean;
  deletedGoogleEventIds: string[];
  morningReminder?: string;
  eveningReminder?: string;
  weeklyReviewReminder?: string;
  timezone?: string;
  defaultCurrency: string;
  budgetMethod: "category" | "envelope" | "zero_based";
  budgetRollover: boolean;
  lockedFinanceMonths: string[];
};

export type GrowthArea = "career" | "learning" | "health" | "finance" | "personal";

export type GrowthGoal = {
  id: string;
  title: string;
  area: GrowthArea;
  progress: number;
  targetDate: string;
  nextAction: string;
  createdAt: string;
  cycleId?: string;
};

export type FocusSession = {
  id: string;
  title: string;
  area: GrowthArea;
  minutes: number;
  date: string;
  note: string;
  linkedGrowthGoalId?: string;
};

export type DailyReview = {
  id: string;
  date: string;
  mood: number;
  energy: number;
  win: string;
  lesson: string;
  nextStep: string;
};

export type KanbanStatus = "backlog" | "ready" | "in_progress" | "review" | "done";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type ProjectBoard = {
  id: string;
  name: string;
  description: string;
  color: string;
  archived: boolean;
  createdAt: string;
};

export type TicketChecklistItem = { id: string; text: string; done: boolean };
export type TicketComment = { id: string; body: string; createdAt: string };

export type KanbanTicket = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: KanbanStatus;
  priority: TicketPriority;
  labels: string[];
  dueDate: string;
  checklist: TicketChecklistItem[];
  comments: TicketComment[];
  linkedScheduleId?: string;
  linkedGrowthGoalId?: string;
  archived: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type LifeArea = GrowthArea;

export type WorkspaceCycle = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "setup" | "active" | "closed";
  closedAt?: string;
  copiedGoalIds?: string[];
};

export type DailyPriorityLink =
  | { type: "goal" | "ticket" | "habit" | "schedule"; id: string }
  | undefined;

export type DailyPriority = {
  id: string;
  date: string;
  text: string;
  done: boolean;
  link?: DailyPriorityLink;
};

export type DailyCheckIn = {
  id: string;
  date: string;
  morningCompletedAt?: string;
  eveningCompletedAt?: string;
  energy?: number;
  reflection?: string;
  win?: string;
  lesson?: string;
  nextStep?: string;
};

export type WeeklyReview = {
  id: string;
  weekStart: string;
  completedAt: string;
  summary: string;
  whatWorked: string;
  nextFocus: string;
};

export type WeeklyQuest = {
  id: string;
  weekStart: string;
  title: string;
  done: boolean;
  link?: DailyPriorityLink;
  createdAt: string;
};

export type Achievement = {
  id: string;
  unlockedAt: string;
};

export type GamificationState = {
  totalXp: number;
  achievements: Achievement[];
  ritualDays: string[];
  perfectDays: string[];
  lastAwardKeys: string[];
};

export type OfflineWorkspace = {
  version: 4 | 5;
  updatedAt: string;
  notes: Note[];
  noteTemplates: NoteTemplate[];
  savedNoteSearches: SavedNoteSearch[];
  habits: WorkspaceHabit[];
  moneySources: MoneySource[];
  savingGoals: SavingGoal[];
  recurringItems: RecurringItem[];
  categoryGroups: CategoryGroup[];
  transactions: Transaction[];
  budgetPlans: BudgetPlan[];
  investments: InvestmentHolding[];
  reconciliations: ReconciliationRecord[];
  financialAudit: FinancialAuditEntry[];
  schedules: WorkspaceSchedule[];
  growthGoals: GrowthGoal[];
  focusSessions: FocusSession[];
  dailyReviews: DailyReview[];
  projects: ProjectBoard[];
  tickets: KanbanTicket[];
  cycle: WorkspaceCycle;
  checkIns: DailyCheckIn[];
  priorities: DailyPriority[];
  weeklyReviews: WeeklyReview[];
  weeklyQuests: WeeklyQuest[];
  gamification: GamificationState;
  settings: WorkspaceSettings;
};

export const growthAreas: Array<{ value: GrowthArea; label: string }> = [
  { value: "career", label: "Karier" },
  { value: "learning", label: "Belajar" },
  { value: "health", label: "Kesehatan" },
  { value: "finance", label: "Keuangan" },
  { value: "personal", label: "Pribadi" }
];

export const moneySourceTypes: Array<{ value: MoneySourceType; label: string }> = [
  { value: "cash", label: "Tunai" },
  { value: "deposit_card", label: "Kartu debit / deposito" },
  { value: "virtual_account", label: "Akun virtual (GoPay, DANA, dll.)" },
  { value: "credit_card", label: "Kartu kredit" },
  { value: "investment", label: "Investasi" },
  { value: "receivable", label: "Piutang" },
  { value: "debt", label: "Hutang" }
];

export function createEmptyWorkspace(): OfflineWorkspace {
  return {
    version: 5,
    updatedAt: new Date(0).toISOString(),
    notes: [],
    noteTemplates: [],
    savedNoteSearches: [],
    habits: [],
    moneySources: [],
    savingGoals: [],
    recurringItems: [],
    categoryGroups: [],
    transactions: [],
    budgetPlans: [],
    investments: [],
    reconciliations: [],
    financialAudit: [],
    schedules: [],
    growthGoals: [],
    focusSessions: [],
    dailyReviews: [],
    projects: [],
    tickets: [],
    cycle: {
      id: "cycle-1",
      name: "Siklus 1",
      startDate: "",
      endDate: "",
      status: "setup",
      copiedGoalIds: []
    },
    checkIns: [],
    priorities: [],
    weeklyReviews: [],
    weeklyQuests: [],
    gamification: {
      totalXp: 0,
      achievements: [],
      ritualDays: [],
      perfectDays: [],
      lastAwardKeys: []
    },
    settings: {
      monthlyBudget: 0,
      hideBalances: false,
      notificationsEnabled: false,
      deletedGoogleEventIds: [],
      timezone: "Asia/Bangkok",
      defaultCurrency: "IDR",
      budgetMethod: "category",
      budgetRollover: false,
      lockedFinanceMonths: []
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function date(value: unknown, fallback = "") {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function rows(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function normalizeAttachments(value: unknown): WorkspaceAttachment[] {
  return rows(value)
    .filter((item) => text(item.id) && text(item.name) && date(item.createdAt))
    .slice(0, 4)
    .map((item) => {
      const dataUrl = text(item.dataUrl);
      return {
        id: text(item.id).slice(0, 128),
        name: text(item.name).slice(0, 180),
        mimeType: text(item.mimeType, "application/octet-stream").slice(0, 100),
        size: Math.max(0, Math.min(180_000, Math.round(number(item.size)))),
        createdAt: date(item.createdAt),
        dataUrl: dataUrl.length <= 180_000 ? dataUrl || undefined : undefined,
        url: /^https?:\/\//i.test(text(item.url)) ? text(item.url).slice(0, 2048) : undefined,
        extractedText: text(item.extractedText).slice(0, 20_000) || undefined
      };
    });
}

function normalizeLinks(value: unknown): WorkspaceEntityLink[] {
  const allowed = ["note", "schedule", "transaction", "savingGoal", "growthGoal", "habit", "ticket", "project"] as const;
  const seen = new Set<string>();
  return rows(value).flatMap((item) => {
    const type = oneOf(item.type, allowed, "note");
    const id = text(item.id).slice(0, 128);
    const key = `${type}:${id}`;
    if (!id || seen.has(key)) return [];
    seen.add(key);
    return [{ type, id }];
  }).slice(0, 50);
}

function normalizeWorkspace(value: Record<string, unknown>): OfflineWorkspace {
  const empty = createEmptyWorkspace();
  const settings = isRecord(value.settings) ? value.settings : {};
  const incomingVersion = typeof value.version === "number" && Number.isInteger(value.version) ? value.version : 1;

  return {
    version: incomingVersion >= 5 ? 5 : 4,
    updatedAt: date(value.updatedAt, empty.updatedAt),
    notes: rows(value.notes)
      .filter((item) => text(item.id) && text(item.title) && date(item.updatedAt))
      .map((item) => ({
        id: text(item.id),
        title: text(item.title),
        content: text(item.content),
        pinned: item.pinned === true,
        updatedAt: date(item.updatedAt),
        folder: text(item.folder),
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
        linkedScheduleId: text(item.linkedScheduleId),
        status: oneOf(item.status, ["active", "archived", "trashed"] as const, "active"),
        deletedAt: date(item.deletedAt) || undefined,
        journalDate: /^\d{4}-\d{2}-\d{2}$/.test(text(item.journalDate)) ? text(item.journalDate) : undefined,
        templateId: text(item.templateId).slice(0, 128) || undefined,
        reminderAt: date(item.reminderAt) || undefined,
        versions: rows(item.versions).filter((version) => text(version.id) && date(version.updatedAt)).slice(-20).map((version) => ({
          id: text(version.id).slice(0, 128),
          title: text(version.title).slice(0, 120),
          content: text(version.content).slice(0, 200_000),
          updatedAt: date(version.updatedAt)
        })),
        attachments: normalizeAttachments(item.attachments),
        links: normalizeLinks(item.links)
      })),
    noteTemplates: rows(value.noteTemplates)
      .filter((item) => text(item.id) && text(item.name))
      .slice(0, 100)
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        name: text(item.name).slice(0, 80),
        title: text(item.title).slice(0, 120),
        content: text(item.content).slice(0, 200_000),
        folder: text(item.folder).slice(0, 80) || undefined,
        tags: Array.isArray(item.tags) ? Array.from(new Set(item.tags.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim())).map((tag) => tag.trim().slice(0, 40)))).slice(0, 20) : []
      })),
    savedNoteSearches: rows(value.savedNoteSearches)
      .filter((item) => text(item.id) && text(item.name))
      .slice(0, 50)
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        name: text(item.name).slice(0, 80),
        query: text(item.query).slice(0, 200),
        folder: text(item.folder).slice(0, 80) || undefined,
        tag: text(item.tag).slice(0, 40) || undefined,
        status: oneOf(item.status, ["active", "archived", "trashed"] as const, "active")
      })),
    habits: rows(value.habits)
      .filter((item) => text(item.id) && text(item.name))
      .map((item) => ({
        id: text(item.id),
        name: text(item.name),
        frequency: oneOf(item.frequency, ["daily", "weekly"], "daily"),
        completedDates: Array.isArray(item.completedDates)
          ? Array.from(new Set(item.completedDates.filter((entry): entry is string => typeof entry === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry)))).sort()
          : [],
        createdAt: date(item.createdAt, new Date().toISOString()),
        linkedGrowthGoalId: text(item.linkedGrowthGoalId)
      })),
    moneySources: rows(value.moneySources)
      .filter((item) => text(item.id) && text(item.name))
      .map((item) => ({
        id: text(item.id),
        name: text(item.name),
        type: oneOf(item.type, moneySourceTypes.map(({ value }) => value), "cash"),
        balance: number(item.balance),
        dueDate: date(item.dueDate),
        installmentAmount: number(item.installmentAmount),
        paymentSourceId: text(item.paymentSourceId),
        institution: text(item.institution).slice(0, 100) || undefined,
        accountLast4: /^\d{2,4}$/.test(text(item.accountLast4)) ? text(item.accountLast4) : undefined,
        currency: /^[A-Z]{3}$/.test(text(item.currency)) ? text(item.currency) : "IDR",
        openingBalance: number(item.openingBalance),
        annualInterestRate: Math.max(0, Math.min(100, number(item.annualInterestRate))),
        minimumPayment: Math.max(0, number(item.minimumPayment)),
        originalPrincipal: Math.max(0, number(item.originalPrincipal)),
        termMonths: Math.max(0, Math.min(1200, Math.round(number(item.termMonths)))),
        statementDay: Math.max(0, Math.min(31, Math.round(number(item.statementDay)))) || undefined
      })),
    savingGoals: rows(value.savingGoals)
      .filter((item) => text(item.id) && text(item.name))
      .map((item) => ({
        id: text(item.id),
        name: text(item.name),
        mode: oneOf(item.mode, ["flexible", "cycle"], "flexible"),
        target: number(item.target),
        saved: number(item.saved),
        cycle: oneOf(item.cycle, ["weekly", "monthly"], "monthly"),
        sourceId: text(item.sourceId),
        autoAmount: number(item.autoAmount),
        nextContributionDate: date(item.nextContributionDate),
        movements: rows(item.movements).map((movement) => ({
          id: text(movement.id, cryptoId()),
          kind: oneOf(movement.kind, ["deposit", "withdrawal"], "deposit"),
          amount: number(movement.amount),
          date: date(movement.date, new Date().toISOString())
        }))
      })),
    recurringItems: rows(value.recurringItems)
      .filter((item) => text(item.id) && text(item.name) && date(item.nextDate))
      .map((item) => ({
        id: text(item.id),
        name: text(item.name),
        kind: oneOf(item.kind, ["payment", "transfer"], "payment"),
        amount: number(item.amount),
        frequency: oneOf(item.frequency, ["weekly", "monthly", "yearly"], "monthly"),
        nextDate: date(item.nextDate),
        sourceId: text(item.sourceId),
        destination: text(item.destination),
        destinationSourceId: text(item.destinationSourceId),
        categoryId: text(item.categoryId),
        autoPost: item.autoPost === true,
        lastPaidDate: date(item.lastPaidDate)
      })),
    categoryGroups: rows(value.categoryGroups)
      .filter((item) => text(item.id) && text(item.name))
      .map((item) => ({
        id: text(item.id),
        name: text(item.name),
        kind: oneOf(item.kind, ["expense", "income"], "expense"),
        monthlyBudget: number(item.monthlyBudget),
        keywords: Array.isArray(item.keywords) ? Array.from(new Set(item.keywords.filter((keyword): keyword is string => typeof keyword === "string" && Boolean(keyword.trim())).map((keyword) => keyword.trim().toLocaleLowerCase("id-ID").slice(0, 50)))).slice(0, 30) : []
      })),
    transactions: rows(value.transactions)
      .filter((item) => text(item.id) && date(item.date) && number(item.amount) > 0)
      .map((item) => ({
        id: text(item.id),
        kind: oneOf(item.kind, ["expense", "income", "transfer"], "expense"),
        amount: number(item.amount),
        date: date(item.date),
        sourceId: text(item.sourceId),
        destinationSourceId: text(item.destinationSourceId),
        destinationGoalId: text(item.destinationGoalId),
        sourceGoalId: text(item.sourceGoalId),
        categoryId: text(item.categoryId),
        note: text(item.note),
        recurringItemId: text(item.recurringItemId),
        goalMovementId: text(item.goalMovementId),
        createdAt: date(item.createdAt, new Date().toISOString()),
        updatedAt: date(item.updatedAt, date(item.createdAt, new Date().toISOString())),
        payee: text(item.payee).slice(0, 160) || undefined,
        status: oneOf(item.status, ["pending", "cleared", "reconciled"] as const, "cleared"),
        externalId: text(item.externalId).slice(0, 200) || undefined,
        clearedAt: date(item.clearedAt) || undefined,
        reconciledAt: date(item.reconciledAt) || undefined,
        linkedNoteId: text(item.linkedNoteId).slice(0, 128) || undefined,
        splits: rows(item.splits).filter((split) => text(split.id) && number(split.amount) > 0).slice(0, 20).map((split) => ({
          id: text(split.id).slice(0, 128),
          amount: number(split.amount),
          categoryId: text(split.categoryId).slice(0, 128) || undefined,
          note: text(split.note).slice(0, 160) || undefined
        })),
        receiptAttachments: normalizeAttachments(item.receiptAttachments)
      })),
    budgetPlans: rows(value.budgetPlans)
      .filter((item) => text(item.id) && /^\d{4}-\d{2}$/.test(text(item.month)) && text(item.categoryId))
      .slice(0, 5000)
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        month: text(item.month),
        categoryId: text(item.categoryId).slice(0, 128),
        planned: Math.max(0, number(item.planned)),
        rollover: number(item.rollover),
        note: text(item.note).slice(0, 240) || undefined
      })),
    investments: rows(value.investments)
      .filter((item) => text(item.id) && text(item.name))
      .slice(0, 1000)
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        name: text(item.name).slice(0, 120),
        symbol: text(item.symbol).slice(0, 24).toUpperCase() || undefined,
        kind: oneOf(item.kind, ["stock", "fund", "crypto", "bond", "gold", "other"] as const, "other"),
        sourceId: text(item.sourceId).slice(0, 128) || undefined,
        units: Math.max(0, number(item.units)),
        costBasis: Math.max(0, number(item.costBasis)),
        currentPrice: Math.max(0, number(item.currentPrice)),
        dividends: Math.max(0, number(item.dividends)),
        updatedAt: date(item.updatedAt, new Date().toISOString())
      })),
    reconciliations: rows(value.reconciliations)
      .filter((item) => text(item.id) && text(item.sourceId) && date(item.statementDate))
      .slice(0, 2000)
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        sourceId: text(item.sourceId).slice(0, 128),
        statementDate: date(item.statementDate),
        statementBalance: number(item.statementBalance),
        workspaceBalance: number(item.workspaceBalance),
        difference: number(item.difference),
        note: text(item.note).slice(0, 240) || undefined,
        createdAt: date(item.createdAt, new Date().toISOString())
      })),
    financialAudit: rows(value.financialAudit)
      .filter((item) => text(item.id) && text(item.entityId) && date(item.occurredAt))
      .slice(0, 5000)
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        action: oneOf(item.action, ["create", "update", "delete", "import", "reconcile", "lock", "unlock"] as const, "update"),
        entityId: text(item.entityId).slice(0, 128),
        summary: text(item.summary).slice(0, 240),
        occurredAt: date(item.occurredAt)
      })),
    schedules: rows(value.schedules)
      .filter((item) => text(item.id) && text(item.title) && date(item.date) && text(item.startTime))
      .map((item) => ({
        id: text(item.id),
        title: text(item.title),
        description: text(item.description),
        date: date(item.date),
        startTime: text(item.startTime),
        endTime: text(item.endTime),
        location: text(item.location),
        status: oneOf(item.status, ["planned", "completed", "cancelled"], "planned"),
        recurrence: oneOf(item.recurrence, ["none", "daily", "weekly", "monthly"], "none"),
        reminderMinutes: number(item.reminderMinutes),
        linkedNoteId: text(item.linkedNoteId),
        linkedGrowthGoalId: text(item.linkedGrowthGoalId),
        googleEventId: text(item.googleEventId),
        source: oneOf(item.source, ["manual", "google_calendar"] as const, "manual")
      })),
    growthGoals: rows(value.growthGoals)
      .filter((item) => text(item.id) && text(item.title))
      .map((item) => ({
        id: text(item.id),
        title: text(item.title).slice(0, 160),
        area: oneOf(item.area, growthAreas.map(({ value }) => value), "personal"),
        progress: Math.max(0, Math.min(100, Math.round(number(item.progress)))),
        targetDate: date(item.targetDate),
        nextAction: text(item.nextAction).slice(0, 240),
        createdAt: date(item.createdAt, new Date().toISOString()),
        cycleId: text(item.cycleId)
      })),
    focusSessions: rows(value.focusSessions)
      .filter((item) => text(item.id) && text(item.title) && date(item.date) && number(item.minutes) > 0)
      .map((item) => ({
        id: text(item.id),
        title: text(item.title).slice(0, 160),
        area: oneOf(item.area, growthAreas.map(({ value }) => value), "personal"),
        minutes: Math.max(1, Math.min(1440, Math.round(number(item.minutes)))),
        date: date(item.date),
        note: text(item.note).slice(0, 1000),
        linkedGrowthGoalId: text(item.linkedGrowthGoalId)
      })),
    dailyReviews: rows(value.dailyReviews)
      .filter((item) => text(item.id) && date(item.date))
      .map((item) => ({
        id: text(item.id),
        date: date(item.date),
        mood: Math.max(1, Math.min(5, Math.round(number(item.mood, 3)))),
        energy: Math.max(1, Math.min(5, Math.round(number(item.energy, 3)))),
        win: text(item.win).slice(0, 1000),
        lesson: text(item.lesson).slice(0, 1000),
        nextStep: text(item.nextStep).slice(0, 1000)
      })),
    projects: rows(value.projects)
      .filter((item) => text(item.id) && text(item.name))
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        name: text(item.name).slice(0, 120),
        description: text(item.description).slice(0, 1000),
        color: /^#[0-9a-f]{6}$/i.test(text(item.color)) ? text(item.color) : "#2563eb",
        archived: item.archived === true,
        createdAt: date(item.createdAt, new Date().toISOString())
      })),
    tickets: rows(value.tickets)
      .filter((item) => text(item.id) && text(item.projectId) && text(item.title))
      .map((item) => ({
        id: text(item.id).slice(0, 128),
        projectId: text(item.projectId).slice(0, 128),
        title: text(item.title).slice(0, 160),
        description: text(item.description).slice(0, 5000),
        status: oneOf(item.status, ["backlog", "ready", "in_progress", "review", "done"], "backlog"),
        priority: oneOf(item.priority, ["low", "medium", "high", "urgent"], "medium"),
        labels: Array.isArray(item.labels) ? Array.from(new Set(item.labels.filter((label): label is string => typeof label === "string" && Boolean(label.trim())).map((label) => label.trim().slice(0, 30)))).slice(0, 10) : [],
        dueDate: date(item.dueDate),
        checklist: rows(item.checklist).filter((entry) => Boolean(text(entry.id) && text(entry.text))).slice(0, 100).map((entry) => ({ id: text(entry.id).slice(0, 128), text: text(entry.text).slice(0, 240), done: entry.done === true })),
        comments: rows(item.comments).filter((entry) => Boolean(text(entry.id) && text(entry.body))).slice(0, 200).map((entry) => ({ id: text(entry.id).slice(0, 128), body: text(entry.body).slice(0, 2000), createdAt: date(entry.createdAt, new Date().toISOString()) })),
        linkedScheduleId: text(item.linkedScheduleId).slice(0, 128),
        linkedGrowthGoalId: text(item.linkedGrowthGoalId).slice(0, 128),
        archived: item.archived === true,
        order: Math.max(0, Math.round(number(item.order))),
        createdAt: date(item.createdAt, new Date().toISOString()),
        updatedAt: date(item.updatedAt, new Date().toISOString())
      })),
    cycle: (() => {
      const cycle = isRecord(value.cycle) ? value.cycle : {};
      const status = oneOf(cycle.status, ["setup", "active", "closed"] as const, "setup");
      return {
        id: text(cycle.id, empty.cycle.id),
        name: text(cycle.name, empty.cycle.name).slice(0, 80),
        startDate: date(cycle.startDate),
        endDate: date(cycle.endDate),
        status,
        closedAt: date(cycle.closedAt),
        copiedGoalIds: Array.isArray(cycle.copiedGoalIds) ? cycle.copiedGoalIds.filter((id): id is string => typeof id === "string").slice(0, 1000) : []
      };
    })(),
    checkIns: rows(value.checkIns)
      .filter((item) => text(item.id) && date(item.date))
      .map((item) => ({
        id: text(item.id),
        date: date(item.date),
        morningCompletedAt: date(item.morningCompletedAt),
        eveningCompletedAt: date(item.eveningCompletedAt),
        energy: item.energy === undefined ? undefined : Math.max(1, Math.min(5, Math.round(number(item.energy, 3)))),
        reflection: text(item.reflection).slice(0, 1000),
        win: text(item.win).slice(0, 1000),
        lesson: text(item.lesson).slice(0, 1000),
        nextStep: text(item.nextStep).slice(0, 1000)
      })),
    priorities: rows(value.priorities)
      .filter((item) => text(item.id) && date(item.date) && text(item.text))
      .map((item) => ({
        id: text(item.id),
        date: date(item.date),
        text: text(item.text).slice(0, 240),
        done: item.done === true,
        link: isRecord(item.link) && text(item.link.id) && oneOf(item.link.type, ["goal", "ticket", "habit", "schedule"] as const, "goal")
          ? { type: oneOf(item.link.type, ["goal", "ticket", "habit", "schedule"] as const, "goal"), id: text(item.link.id) }
          : undefined
      })),
    weeklyReviews: rows(value.weeklyReviews)
      .filter((item) => text(item.id) && date(item.weekStart) && date(item.completedAt))
      .map((item) => ({
        id: text(item.id),
        weekStart: date(item.weekStart),
        completedAt: date(item.completedAt),
        summary: text(item.summary).slice(0, 1000),
        whatWorked: text(item.whatWorked).slice(0, 1000),
        nextFocus: text(item.nextFocus).slice(0, 1000)
      })),
    weeklyQuests: rows(value.weeklyQuests)
      .filter((item) => text(item.id) && date(item.weekStart) && text(item.title))
      .map((item) => ({
        id: text(item.id),
        weekStart: date(item.weekStart),
        title: text(item.title).slice(0, 240),
        done: item.done === true,
        createdAt: date(item.createdAt, new Date().toISOString()),
        link: isRecord(item.link) && text(item.link.id) && oneOf(item.link.type, ["goal", "ticket", "habit", "schedule"] as const, "goal")
          ? { type: oneOf(item.link.type, ["goal", "ticket", "habit", "schedule"] as const, "goal"), id: text(item.link.id) }
          : undefined
      })),
    gamification: (() => {
      const gamification = isRecord(value.gamification) ? value.gamification : {};
      const achievements = rows(gamification.achievements).filter((item) => text(item.id) && date(item.unlockedAt)).map((item) => ({ id: text(item.id), unlockedAt: date(item.unlockedAt) }));
      const dates = (input: unknown) => Array.isArray(input) ? Array.from(new Set(input.filter((item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item)))).sort().slice(-5000) : [];
      return {
        totalXp: Math.max(0, Math.round(number(gamification.totalXp))),
        achievements,
        ritualDays: dates(gamification.ritualDays),
        perfectDays: dates(gamification.perfectDays),
        lastAwardKeys: Array.isArray(gamification.lastAwardKeys) ? gamification.lastAwardKeys.filter((item): item is string => typeof item === "string").slice(-5000) : []
      };
    })(),
    settings: {
      monthlyBudget: number(settings.monthlyBudget),
      hideBalances: settings.hideBalances === true,
      notificationsEnabled: settings.notificationsEnabled === true,
      deletedGoogleEventIds: Array.isArray(settings.deletedGoogleEventIds)
        ? Array.from(new Set(settings.deletedGoogleEventIds.filter((id): id is string => typeof id === "string" && Boolean(id))).values()).slice(0, 1000)
        : [],
      morningReminder: text(settings.morningReminder),
      eveningReminder: text(settings.eveningReminder),
      weeklyReviewReminder: text(settings.weeklyReviewReminder),
      timezone: text(settings.timezone, "Asia/Bangkok"),
      defaultCurrency: /^[A-Z]{3}$/.test(text(settings.defaultCurrency)) ? text(settings.defaultCurrency) : "IDR",
      budgetMethod: oneOf(settings.budgetMethod, ["category", "envelope", "zero_based"] as const, "category"),
      budgetRollover: settings.budgetRollover === true,
      lockedFinanceMonths: Array.isArray(settings.lockedFinanceMonths)
        ? Array.from(new Set(settings.lockedFinanceMonths.filter((month): month is string => typeof month === "string" && /^\d{4}-\d{2}$/.test(month))).values()).sort().slice(-120)
        : []
    }
  };
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() ?? `legacy-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parseWorkspace(serialized: string): OfflineWorkspace | null {
  try {
    const value = JSON.parse(serialized) as unknown;
    return isRecord(value) ? normalizeWorkspace(value) : null;
  } catch {
    return null;
  }
}

export function loadWorkspace(serialized: string | null): OfflineWorkspace {
  return serialized ? parseWorkspace(serialized) ?? createEmptyWorkspace() : createEmptyWorkspace();
}

export function touchWorkspace(workspace: OfflineWorkspace): OfflineWorkspace {
  return { ...workspace, version: 5, updatedAt: new Date().toISOString() };
}

export function upsertById<T extends { id: string }>(items: T[], item: T) {
  return items.some(({ id }) => id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [item, ...items];
}

export function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id);
}
