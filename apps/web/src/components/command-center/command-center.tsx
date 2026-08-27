"use client";

import {
  ArrowRight,
  Banknote,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Flame,
  LayoutDashboard,
  List,
  ListChecks,
  ListOrdered,
  LockKeyhole,
  NotebookPen,
  PanelsTopLeft,
  Pencil,
  PiggyBank,
  Pin,
  PinOff,
  Plus,
  ReceiptText,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  Tags,
  Target,
  TrendingUp,
  Trash2,
  WalletCards,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  WORKSPACE_SYNC_KEY,
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspace,
  loadWorkspace,
  touchWorkspace,
  moneySourceTypes,
  removeById,
  upsertById,
  type CategoryGroup,
  type MoneySource,
  type Note,
  type OfflineWorkspace,
  type RecurringItem,
  type SavingGoal,
  type Transaction,
} from "@/lib/offline-workspace";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AgendaPanel } from "@/components/command-center/agenda-panel";
import { TransactionsPanel } from "@/components/command-center/transactions-panel";
import { WorkspaceSettings } from "@/components/command-center/workspace-settings";
import { GlobalSearch } from "@/components/command-center/global-search";
import { WorkspaceHabits } from "@/components/command-center/workspace-habits";
import { GrowthCenter } from "@/components/command-center/growth-center";
import { KanbanBoard } from "@/components/command-center/kanban-board";
import { LifeOsPanel } from "@/components/command-center/life-os-panel";
import { QuickCapture } from "@/components/command-center/quick-capture";
import { cn, formatCurrency } from "@/lib/utils";
import { advanceRecurringDate, moveGoalFunds, putTransaction, runWorkspaceAutomation } from "@/lib/workspace-finance";
import { formatNoteList, splitQuickNote, type NoteListStyle } from "@/lib/notes";
import { dailyMotivation } from "@/lib/growth";

type WorkspaceSection = "overview" | "notes" | "sources" | "goals" | "recurring" | "categories";
type ModuleSection = "agenda" | "transaksi" | "kebiasaan" | "perkembangan" | "proyek" | "pengaturan";
type Section = WorkspaceSection | ModuleSection;
type SyncState = "offline" | "syncing" | "synced" | "conflict" | "error";

const sections = [
  { id: "overview" as const, label: "Ringkasan", icon: LayoutDashboard },
  { id: "notes" as const, label: "Notes", icon: NotebookPen },
  { id: "sources" as const, label: "Sumber uang", icon: WalletCards },
  { id: "goals" as const, label: "Tujuan", icon: PiggyBank },
  { id: "recurring" as const, label: "Berkala", icon: CalendarClock },
  { id: "categories" as const, label: "Kategori", icon: Tags }
];

const modules = [
  { id: "agenda" as const, label: "Agenda", icon: CalendarDays },
  { id: "transaksi" as const, label: "Transaksi", icon: WalletCards },
  { id: "kebiasaan" as const, label: "Kebiasaan", icon: ClipboardCheck },
  { id: "perkembangan" as const, label: "Perkembangan", icon: TrendingUp },
  { id: "proyek" as const, label: "Proyek", icon: PanelsTopLeft },
  { id: "pengaturan" as const, label: "Pengaturan", icon: Settings }
];

const financeDashboardSections = [modules[1], sections[2], sections[3], sections[4], sections[5]];
const agendaDashboardSections = [modules[0], modules[4], modules[2], modules[3], sections[1]];
const dashboardSections = [sections[0], ...financeDashboardSections, ...agendaDashboardSections, modules[4]];
const dashboardNavigation = [sections[0], { ...modules[1], label: "Keuangan" }, modules[0], modules[4], modules[2], modules[3], sections[1], modules[5]];

function isWorkspaceSection(section: Section): section is WorkspaceSection {
  return sections.some(({ id }) => id === section);
}

const liabilityTypes = new Set(["credit_card", "debt"]);

function dateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function goalForecast(goal: SavingGoal) {
  if (!goal.autoAmount || goal.saved >= goal.target) return "";
  const cycles = Math.ceil((goal.target - goal.saved) / goal.autoAmount);
  const date = new Date(`${goal.nextContributionDate || dateInputValue()}T12:00:00`);
  if (goal.cycle === "weekly") date.setDate(date.getDate() + cycles * 7);
  else {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + cycles);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  }
  return dateInputValue(date);
}

function numberValue(data: FormData, key: string) {
  return Number(data.get(key)) || 0;
}

function nextId() {
  return crypto.randomUUID();
}

function vapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function CommandCenter() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<OfflineWorkspace>(createEmptyWorkspace);
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("offline");
  const [syncMeta, setSyncMeta] = useState({ revision: 0, workspaceUpdatedAt: createEmptyWorkspace().updatedAt });
  const [syncBaseWorkspace, setSyncBaseWorkspace] = useState<OfflineWorkspace | null>(null);
  const [remoteConflict, setRemoteConflict] = useState<OfflineWorkspace | null>(null);
  const [remoteConflictRevision, setRemoteConflictRevision] = useState(0);
  const [active, setActive] = useState<Section>("overview");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const syncRequest = useRef<AbortController | null>(null);
  const workspaceRef = useRef(workspace);
  const syncMetaRef = useRef(syncMeta);
  const syncBaseRef = useRef(syncBaseWorkspace);

  useEffect(() => {
    workspaceRef.current = workspace;
    syncMetaRef.current = syncMeta;
    syncBaseRef.current = syncBaseWorkspace;
  }, [syncBaseWorkspace, syncMeta, workspace]);

  useEffect(() => {
    const currentStored = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const legacyStored = localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);
    const loaded = loadWorkspace(currentStored ?? legacyStored);
    const migrated = !currentStored && legacyStored ? touchWorkspace(loaded) : loaded;
    const automation = runWorkspaceAutomation(migrated);
    setWorkspace(automation.changed ? touchWorkspace(automation.workspace) : migrated);
    setOnline(navigator.onLine);
    const storedSync = localStorage.getItem(WORKSPACE_SYNC_KEY);
    if (storedSync) {
      try {
        const value = JSON.parse(storedSync) as { revision?: unknown; workspaceUpdatedAt?: unknown; baseData?: unknown };
        setSyncMeta({
          revision: typeof value.revision === "number" ? value.revision : 0,
          workspaceUpdatedAt: typeof value.workspaceUpdatedAt === "string" ? value.workspaceUpdatedAt : migrated.updatedAt
        });
        if (value.baseData) setSyncBaseWorkspace(loadWorkspace(JSON.stringify(value.baseData)));
      } catch {
        localStorage.removeItem(WORKSPACE_SYNC_KEY);
      }
    }
    setHydrated(true);

    const syncWorkspace = (event: StorageEvent) => {
      if (event.key === WORKSPACE_STORAGE_KEY) setWorkspace(loadWorkspace(event.newValue));
    };
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    addEventListener("storage", syncWorkspace);
    addEventListener("online", goOnline);
    addEventListener("offline", goOffline);
    return () => {
      removeEventListener("storage", syncWorkspace);
      removeEventListener("online", goOnline);
      removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    localStorage.setItem(WORKSPACE_SYNC_KEY, JSON.stringify({ ...syncMeta, baseData: syncBaseWorkspace }));
  }, [hydrated, syncBaseWorkspace, syncMeta, workspace]);

  useEffect(() => {
    if (!hydrated || !online) {
      if (hydrated) setSyncState("offline");
      return;
    }

    const controller = new AbortController();
    syncRequest.current?.abort();
    syncRequest.current = controller;
    fetch("/api/workspace", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Workspace sync gagal.");
        return response.json() as Promise<{ data: OfflineWorkspace; revision: number; exists: boolean }>;
      })
      .then((remote) => {
        const dirty = workspaceRef.current.updatedAt !== syncMetaRef.current.workspaceUpdatedAt;
        if (remote.exists && dirty && remote.revision !== syncMetaRef.current.revision) {
          setRemoteConflict(loadWorkspace(JSON.stringify(remote.data)));
          setRemoteConflictRevision(remote.revision);
          setSyncState("conflict");
          return;
        }
        if (!dirty && remote.revision > syncMetaRef.current.revision) {
          const next = loadWorkspace(JSON.stringify(remote.data));
          setWorkspace(next);
          setSyncBaseWorkspace(next);
          setSyncMeta({ revision: remote.revision, workspaceUpdatedAt: next.updatedAt });
          setSyncState("synced");
          return;
        }
        if (!remote.exists && !dirty) {
          const next = loadWorkspace(JSON.stringify(remote.data));
          setWorkspace(next);
          setSyncBaseWorkspace(next);
          setSyncMeta({ revision: 0, workspaceUpdatedAt: remote.data.updatedAt });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSyncState("error");
      });

    return () => controller.abort();
  }, [hydrated, online]);

  useEffect(() => {
    if (!hydrated || !online || remoteConflict || workspace.updatedAt === syncMeta.workspaceUpdatedAt) return;
    setSyncState("syncing");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: workspace, baseData: syncBaseRef.current ?? workspace, baseRevision: syncMeta.revision })
        });
        const payload = await response.json() as { data?: OfflineWorkspace; revision?: number; updatedAt?: string; conflicts?: unknown[] };
        if (response.status === 409 && payload.data) {
          setRemoteConflict(loadWorkspace(JSON.stringify(payload.data)));
          setRemoteConflictRevision(payload.revision ?? syncMeta.revision);
          setSyncState("conflict");
          return;
        }
        if (!response.ok || typeof payload.revision !== "number") throw new Error("Sync gagal.");
        setSyncMeta({ revision: payload.revision, workspaceUpdatedAt: workspace.updatedAt });
        setSyncBaseWorkspace(workspace);
        setSyncState("synced");
      } catch {
        setSyncState("error");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hydrated, online, remoteConflict, syncMeta.revision, syncMeta.workspaceUpdatedAt, workspace]);

  useEffect(() => {
    if (!hydrated || !workspace.settings.notificationsEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
    const check = () => {
      const now = new Date();
      const todayValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const minute = now.getHours() * 60 + now.getMinutes();
      for (const schedule of workspace.schedules) {
        if (schedule.date !== todayValue || !schedule.reminderMinutes) continue;
        const [hours, minutes] = schedule.startTime.split(":").map(Number);
        const reminderAt = hours * 60 + minutes - schedule.reminderMinutes;
        if (minute !== reminderAt) continue;
        const key = `reminder:${schedule.id}:${todayValue}:${reminderAt}`;
        if (sessionStorage.getItem(key)) continue;
        new Notification(`Agenda: ${schedule.title}`, { body: `${schedule.reminderMinutes} menit lagi · ${schedule.startTime}` });
        sessionStorage.setItem(key, "1");
      }
      for (const recurring of workspace.recurringItems) {
        if (recurring.nextDate > todayValue) continue;
        const key = `recurring:${recurring.id}:${recurring.nextDate}`;
        if (sessionStorage.getItem(key)) continue;
        new Notification(`Tagihan: ${recurring.name}`, { body: `Jatuh tempo ${recurring.nextDate}` });
        sessionStorage.setItem(key, "1");
      }
      const nowValue = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
      const ritualReminders = [
        [workspace.settings.morningReminder, "Ritual pagi", "Tentukan energi dan tiga prioritasmu."],
        [workspace.settings.eveningReminder, "Ritual malam", "Catat kemenangan, pelajaran, dan langkah besok."],
        [now.getDay() === 0 ? workspace.settings.weeklyReviewReminder : undefined, "Review mingguan", "Lima menit untuk melihat apa yang berjalan dan memilih fokus berikutnya."]
      ] as const;
      for (const [time, title, body] of ritualReminders) {
        if (!time || time !== nowValue) continue;
        const key = "ritual:" + title + ":" + todayValue;
        if (sessionStorage.getItem(key)) continue;
        new Notification(title, { body });
        sessionStorage.setItem(key, "1");
      }
    };
    check();
    const timer = window.setInterval(check, 30_000);
    return () => window.clearInterval(timer);
  }, [hydrated, workspace.recurringItems, workspace.schedules, workspace.settings.eveningReminder, workspace.settings.morningReminder, workspace.settings.notificationsEnabled, workspace.settings.weeklyReviewReminder]);

  function updateWorkspace(updater: (current: OfflineWorkspace) => OfflineWorkspace) {
    setWorkspace((current) => touchWorkspace(updater(current)));
  }

  function useRemoteWorkspace() {
    if (!remoteConflict) return;
    setWorkspace(remoteConflict);
    setSyncBaseWorkspace(remoteConflict);
    setSyncMeta({ revision: remoteConflictRevision, workspaceUpdatedAt: remoteConflict.updatedAt });
    setRemoteConflict(null);
    setSyncState("synced");
  }

  async function keepLocalWorkspace() {
    if (!remoteConflict) return;
    setRemoteConflict(null);
    setSyncState("syncing");
    try {
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: workspace, baseRevision: remoteConflictRevision, force: true })
      });
      const payload = await response.json() as { revision?: number };
      if (!response.ok || typeof payload.revision !== "number") throw new Error("Sync gagal.");
      setSyncMeta({ revision: payload.revision, workspaceUpdatedAt: workspace.updatedAt });
      setSyncBaseWorkspace(workspace);
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      alert("Browser ini belum mendukung notifikasi.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Izin notifikasi belum diberikan.");
      return;
    }

    updateWorkspace((current) => ({ ...current, settings: { ...current.settings, notificationsEnabled: true } }));
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      const configResponse = await fetch("/api/push-subscriptions");
      const config = await configResponse.json() as { configured?: boolean; publicKey?: string };
      if (!configResponse.ok || !config.configured || !config.publicKey) return;
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(config.publicKey) });
      const response = await fetch("/api/push-subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      if (!response.ok) throw new Error("Push subscription gagal disimpan.");
    } catch (error) {
      console.error("Push notification gagal diaktifkan; pengingat lokal tetap aktif.", error);
    }
  }

  async function lockApp() {
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  async function resetWorkspace() {
    if (!confirm("Reset seluruh data Marco Life OS? Data internal tidak dapat dipulihkan. Acara Google Calendar tetap aman.")) return;
    const response = await fetch("/api/workspace", { method: "DELETE" });
    if (!response.ok) return;
    const payload = await response.json() as { data?: OfflineWorkspace };
    const next = payload.data ? loadWorkspace(JSON.stringify(payload.data)) : createEmptyWorkspace();
    setWorkspace(next);
    setSyncBaseWorkspace(next);
    setSyncMeta({ revision: 1, workspaceUpdatedAt: next.updatedAt });
    setRemoteConflict(null);
    setSyncState("synced");
  }

  const summaries = useMemo(() => {
    const assets = workspace.moneySources
      .filter(({ type }) => !liabilityTypes.has(type))
      .reduce((sum, { balance }) => sum + balance, 0);
    const liabilities = workspace.moneySources
      .filter(({ type }) => liabilityTypes.has(type))
      .reduce((sum, { balance }) => sum + Math.abs(balance), 0);
    const goalSaved = workspace.savingGoals.reduce((sum, { saved }) => sum + saved, 0);
    const todayValue = dateInputValue();
    const upcoming = workspace.schedules.filter(({ date, status }) => date >= todayValue && status === "planned").length
      + workspace.recurringItems.filter(({ nextDate }) => nextDate >= todayValue).length;
    return { assets, liabilities, goalSaved, upcoming };
  }, [workspace]);

  const motivation = useMemo(() => dailyMotivation(workspace), [workspace]);

  const displayMoney = (value: number) => workspace.settings.hideBalances ? "••••••" : formatCurrency(value);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("id-ID");
    return [...workspace.notes]
      .filter((note) => !query || `${note.title} ${note.content} ${(note.tags ?? []).join(" ")} ${note.folder ?? ""}`.toLocaleLowerCase("id-ID").includes(query))
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }, [search, workspace.notes]);

  function changeSection(section: Section) {
    setActive(section);
    setFormOpen(false);
    setEditingId(null);
  }

  function openCreate(section: WorkspaceSection) {
    if (section !== active) changeSection(section);
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(section: WorkspaceSection, id: string) {
    if (section !== active) changeSection(section);
    setEditingId(id);
    setFormOpen(true);
    scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function remove(section: Exclude<WorkspaceSection, "overview">, id: string, name: string) {
    if (!confirm(`Hapus “${name}”?`)) return;
    updateWorkspace((current) => {
      if (section === "notes") return { ...current, notes: removeById(current.notes, id), schedules: current.schedules.map((schedule) => schedule.linkedNoteId === id ? { ...schedule, linkedNoteId: undefined } : schedule) };
      if (section === "sources") {
        return {
          ...current,
          moneySources: removeById(current.moneySources, id),
          recurringItems: current.recurringItems
            .filter((item) => item.id !== `installment-${id}`)
            .map((item) => ({
              ...item,
              sourceId: item.sourceId === id ? "" : item.sourceId,
              destinationSourceId: item.destinationSourceId === id ? undefined : item.destinationSourceId
            })),
          savingGoals: current.savingGoals.map((goal) => goal.sourceId === id ? { ...goal, sourceId: undefined } : goal)
        };
      }
      if (section === "goals") return { ...current, savingGoals: removeById(current.savingGoals, id) };
      if (section === "recurring") return { ...current, recurringItems: removeById(current.recurringItems, id) };
      return {
        ...current,
        categoryGroups: removeById(current.categoryGroups, id),
        transactions: current.transactions.map((item) => item.categoryId === id ? { ...item, categoryId: undefined } : item),
        recurringItems: current.recurringItems.map((item) => item.categoryId === id ? { ...item, categoryId: undefined } : item)
      };
    });
  }

  function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const previous = workspace.notes.find(({ id }) => id === editingId);
    const note: Note = {
      id: previous?.id ?? nextId(),
      title: String(data.get("title")).trim(),
      content: String(data.get("content")).trim(),
      pinned: previous?.pinned ?? false,
      updatedAt: new Date().toISOString(),
      folder: String(data.get("folder") || "").trim(),
      tags: String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      linkedScheduleId: previous?.linkedScheduleId
    };
    updateWorkspace((current) => ({ ...current, notes: upsertById(current.notes, note) }));
    closeForm();
  }

  function quickSaveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = splitQuickNote(String(new FormData(form).get("quickNote") || ""));
    if (!value) return;
    const note: Note = {
      id: nextId(),
      title: value.title,
      content: value.content,
      pinned: false,
      updatedAt: new Date().toISOString(),
      folder: "",
      tags: []
    };
    updateWorkspace((current) => ({ ...current, notes: upsertById(current.notes, note) }));
    form.reset();
  }

  function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const source: MoneySource = {
      id: editingId ?? nextId(),
      name: String(data.get("name")).trim(),
      type: data.get("type") as MoneySource["type"],
      balance: numberValue(data, "balance"),
      dueDate: String(data.get("dueDate") || "") || undefined,
      installmentAmount: numberValue(data, "installmentAmount") || undefined,
      paymentSourceId: String(data.get("paymentSourceId") || "") || undefined
    };
    updateWorkspace((current) => {
      const moneySources = upsertById(current.moneySources, source);
      if (!source.dueDate || !source.installmentAmount || !source.paymentSourceId || (source.type !== "credit_card" && source.type !== "debt")) {
        return { ...current, moneySources, recurringItems: current.recurringItems.filter(({ id }) => id !== `installment-${source.id}`) };
      }
      const installment: RecurringItem = {
        id: `installment-${source.id}`,
        name: `Cicilan ${source.name}`,
        kind: "transfer",
        amount: source.installmentAmount,
        frequency: "monthly",
        nextDate: source.dueDate,
        sourceId: source.paymentSourceId,
        destination: source.name,
        destinationSourceId: source.id,
        autoPost: false
      };
      return { ...current, moneySources, recurringItems: upsertById(current.recurringItems, installment) };
    });
    closeForm();
  }

  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const goal: SavingGoal = {
      id: editingId ?? nextId(),
      name: String(data.get("name")).trim(),
      mode: data.get("mode") as SavingGoal["mode"],
      target: numberValue(data, "target"),
      saved: numberValue(data, "saved"),
      cycle: data.get("cycle") as SavingGoal["cycle"],
      sourceId: String(data.get("sourceId") || "") || undefined,
      autoAmount: numberValue(data, "autoAmount") || undefined,
      nextContributionDate: String(data.get("nextContributionDate") || "") || undefined,
      movements: editingGoal?.movements ?? []
    };
    updateWorkspace((current) => ({ ...current, savingGoals: upsertById(current.savingGoals, goal) }));
    closeForm();
  }

  function saveRecurring(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item: RecurringItem = {
      id: editingId ?? nextId(),
      name: String(data.get("name")).trim(),
      kind: data.get("kind") as RecurringItem["kind"],
      amount: numberValue(data, "amount"),
      frequency: data.get("frequency") as RecurringItem["frequency"],
      nextDate: String(data.get("nextDate") || dateInputValue()),
      sourceId: String(data.get("sourceId")),
      destination: String(data.get("destination")).trim(),
      destinationSourceId: String(data.get("destinationSourceId") || "") || undefined,
      categoryId: String(data.get("categoryId") || "") || undefined,
      autoPost: data.get("autoPost") === "on",
      lastPaidDate: editingRecurring?.lastPaidDate
    };
    updateWorkspace((current) => ({ ...current, recurringItems: upsertById(current.recurringItems, item) }));
    closeForm();
  }

  function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const category: CategoryGroup = {
      id: editingId ?? nextId(),
      name: String(data.get("name")).trim(),
      kind: data.get("kind") as CategoryGroup["kind"],
      monthlyBudget: numberValue(data, "monthlyBudget") || undefined
    };
    updateWorkspace((current) => ({ ...current, categoryGroups: upsertById(current.categoryGroups, category) }));
    closeForm();
  }

  function payRecurring(item: RecurringItem) {
    updateWorkspace((current) => {
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        kind: item.kind === "transfer" ? "transfer" : "expense",
        amount: item.amount,
        date: item.nextDate,
        sourceId: item.sourceId,
        destinationSourceId: item.destinationSourceId,
        categoryId: item.categoryId,
        note: item.name,
        recurringItemId: item.id,
        createdAt: new Date().toISOString()
      };
      const next = putTransaction(current, transaction);
      return {
        ...next,
        recurringItems: next.recurringItems.map((currentItem) => currentItem.id === item.id
          ? { ...currentItem, nextDate: advanceRecurringDate(item.nextDate, item.frequency), lastPaidDate: item.nextDate }
          : currentItem)
      };
    });
  }

  const editingNote = workspace.notes.find(({ id }) => id === editingId);
  const editingSource = workspace.moneySources.find(({ id }) => id === editingId);
  const editingGoal = workspace.savingGoals.find(({ id }) => id === editingId);
  const editingRecurring = workspace.recurringItems.find(({ id }) => id === editingId);
  const editingCategory = workspace.categoryGroups.find(({ id }) => id === editingId);
  const navigationActive = financeDashboardSections.some(({ id }) => id === active) ? "transaksi" : active;

  if (!hydrated) {
    return <div className="grid min-h-screen place-items-center text-sm font-semibold text-ink/50">Memuat workspace lokal…</div>;
  }

  const page = (
    <main className="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-clay">
              Pusat kendali
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-ink sm:text-3xl dark:text-paper">
              {dashboardSections.find(({ id }) => id === active)?.label}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="button-secondary h-10 w-10 justify-center p-0" onClick={lockApp} aria-label="Kunci aplikasi" title="Kunci aplikasi"><LockKeyhole className="h-4 w-4" /></button>
            <ThemeToggle compact />
            <button type="button" className="button-secondary h-10 w-10 justify-center p-0" onClick={() => setGlobalSearchOpen(true)} aria-label="Pencarian global" title="Pencarian global"><Search className="h-4 w-4" /></button>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold", online ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300")}>
              {online ? <Wifi className="h-3.5 w-3.5" aria-hidden="true" /> : <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />}
              {online ? syncState === "synced" ? "Tersinkron" : syncState === "syncing" ? "Menyinkronkan…" : syncState === "conflict" ? "Konflik data" : "Online" : "Offline · tersimpan lokal"}
            </span>
            {isWorkspaceSection(active) && active !== "overview" ? (
              <button className="button-primary px-3" type="button" onClick={() => openCreate(active)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Tambah</span>
              </button>
            ) : null}
          </div>
        </header>

        {globalSearchOpen ? <GlobalSearch workspace={workspace} onClose={() => setGlobalSearchOpen(false)} onNavigate={changeSection} /> : null}

        {active === "overview" ? (
          <div className="grid gap-5">
            <section className="motivation-hero relative isolate overflow-hidden rounded-[1.75rem] p-5 text-white shadow-xl shadow-blue-950/20 sm:p-7" aria-labelledby="daily-motivation-title">
              <div className="relative z-10 grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)]">
                <div className="flex min-w-0 flex-col justify-center">
                  <p className="flex items-center gap-2 text-sm font-bold text-blue-100">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {motivation.greeting} · {new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
                  </p>
                  <h2 id="daily-motivation-title" className="mt-4 max-w-3xl text-2xl font-black leading-tight tracking-tight sm:text-4xl">
                    {motivation.message}
                  </h2>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-blue-800 shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-blue-50" onClick={() => changeSection(motivation.target)}>
                      Mulai langkah ini <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-blue-50 backdrop-blur">
                      <Flame className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                      {motivation.totalToday ? `${motivation.completedToday} dari ${motivation.totalToday} ritme selesai` : "Hari ini siap dimulai"}
                    </span>
                  </div>
                </div>

                <article className="rounded-2xl border border-white/20 bg-white/10 p-5 shadow-inner backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-100">Misi hari ini</p>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><Target className="h-5 w-5" aria-hidden="true" /></span>
                  </div>
                  <p className="mt-5 text-lg font-black leading-snug">{motivation.mission}</p>
                  {motivation.goalProgress > 0 && motivation.goalProgress < 100 ? (
                    <div className="mt-5">
                      <div className="mb-2 flex justify-between text-xs font-bold text-blue-100"><span>Progres tujuan</span><span>{motivation.goalProgress}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-blue-950/35"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-white" style={{ width: `${motivation.goalProgress}%` }} /></div>
                    </div>
                  ) : null}
                </article>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Ringkasan keuangan">
              {[
                { label: "Total aset", value: displayMoney(summaries.assets), icon: Banknote },
                { label: "Kewajiban", value: displayMoney(summaries.liabilities), icon: CreditCard },
                { label: "Tabungan", value: displayMoney(summaries.goalSaved), icon: PiggyBank },
                { label: "Mendatang", value: String(summaries.upcoming), icon: CalendarClock }
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <article className="panel group rounded-2xl p-4 sm:p-5" key={metric.label}>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:scale-105 dark:bg-blue-400/10 dark:text-blue-300"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink/45 dark:text-paper/45">{metric.label}</p>
                    <p className="mt-1 break-words text-lg font-black text-ink sm:text-xl dark:text-paper">{metric.value}</p>
                  </article>
                );
              })}
            </section>

            <LifeOsPanel workspace={workspace} updateWorkspace={updateWorkspace} onNavigate={changeSection} />

            <section className="grid gap-4 lg:grid-cols-2" aria-label="Area kerja">
              <article className="panel rounded-2xl p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-clay">Keuangan</p>
                <h3 className="mt-2 text-xl font-black">Kelola arus dan aset</h3>
                <p className="mt-2 text-sm leading-6 text-ink/55 dark:text-paper/50">Transaksi, sumber uang, tabungan, transaksi berkala, dan kategori.</p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {financeDashboardSections.map((section) => {
                    const Icon = section.icon;
                    return <button key={section.id} type="button" onClick={() => changeSection(section.id)} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-left text-sm font-bold transition hover:border-clay dark:border-white/10 dark:bg-white/5"><Icon className="h-4 w-4 text-clay" />{section.label}</button>;
                  })}
                </div>
              </article>

              <article className="panel rounded-2xl p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss dark:text-emerald-300">Agenda & produktivitas</p>
                <h3 className="mt-2 text-xl font-black">Kelola waktu dan fokus</h3>
                <p className="mt-2 text-sm leading-6 text-ink/55 dark:text-paper/50">Agenda, kebiasaan, perkembangan, dan notes berada dalam satu kelompok.</p>
                <div className="mt-5 grid gap-2">
                  {agendaDashboardSections.map((section) => {
                    const Icon = section.icon;
                    return <button key={section.id} type="button" onClick={() => changeSection(section.id)} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-left text-sm font-bold transition hover:border-moss dark:border-white/10 dark:bg-white/5"><Icon className="h-4 w-4 text-moss dark:text-emerald-300" />{section.label}</button>;
                  })}
                </div>
              </article>
            </section>
          </div>
        ) : null}

        {active === "notes" ? (
          <section className="grid gap-4">
            {formOpen ? (
              <Editor title={editingNote ? "Ubah note" : "Note baru"} onClose={closeForm}>
                <form className="grid gap-4" onSubmit={saveNote} key={editingNote?.id ?? "new-note"}>
                  <Field label="Judul" name="title" defaultValue={editingNote?.title} placeholder="Contoh: Ide minggu ini" maxLength={120} />
                  <div className="grid gap-4 sm:grid-cols-2"><Field label="Folder" name="folder" defaultValue={editingNote?.folder} placeholder="Pribadi, kerja…" maxLength={40} required={false} /><Field label="Tag" name="tags" defaultValue={editingNote?.tags?.join(", ")} placeholder="penting, ide" maxLength={120} required={false} /></div>
                  <NoteEditorField defaultValue={editingNote?.content} />
                  <FormActions editing={Boolean(editingNote)} onCancel={closeForm} />
                </form>
              </Editor>
            ) : null}
            <div className="notes-chat overflow-hidden rounded-2xl border border-ink/10 shadow-panel dark:border-white/10">
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink/10 bg-[#edf4ff]/95 p-3 backdrop-blur dark:border-white/10 dark:bg-[#0b1f3a]/95">
                <Search className="ml-1 h-4 w-4 text-ink/40 dark:text-paper/40" aria-hidden="true" />
                <label htmlFor="note-search" className="sr-only">Cari notes</label>
                <input id="note-search" type="search" className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari judul atau isi note…" />
                <button type="button" className="button-secondary h-9 shrink-0 px-3" onClick={() => openCreate("notes")}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Detail</span></button>
              </div>

              <div className="grid min-h-[52vh] content-end gap-3 p-3 sm:p-5">
                {visibleNotes.map((note, index) => {
                  const showDate = index === 0 || noteDayKey(visibleNotes[index - 1].updatedAt) !== noteDayKey(note.updatedAt);
                  return (
                    <Fragment key={note.id}>
                      {showDate ? <div className="my-1 flex justify-center"><span className="rounded-lg bg-ink/70 px-3 py-1 text-xs font-bold text-white shadow-sm dark:bg-black/45">{noteDateLabel(note.updatedAt)}</span></div> : null}
                      <article className={cn("note-bubble relative ml-auto w-fit min-w-52 max-w-[92%] rounded-xl rounded-tr-sm px-4 pb-2 pt-3 shadow-sm sm:max-w-[78%]", note.pinned && "ring-2 ring-amber-400/60")}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">{note.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-amber-700" /> : null}<h2 className="break-words text-[15px] font-black sm:text-base">{note.title}</h2></div>
                            {note.folder || (note.tags ?? []).length > 0 ? <p className="mt-1 text-[11px] font-semibold text-[#2359a8] dark:text-blue-100/70">{note.folder ? note.folder : ""}{note.folder && note.tags?.length ? " · " : ""}{note.tags?.map((tag) => `#${tag}`).join(" ")}</p> : null}
                          </div>
                          <details className="group relative shrink-0">
                            <summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-full text-[#2359a8] hover:bg-black/5 dark:text-blue-100/70 dark:hover:bg-white/10" aria-label={`Aksi untuk ${note.title}`}><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary>
                            <div className="absolute right-0 top-8 z-20 grid min-w-36 overflow-hidden rounded-xl border border-black/10 bg-white py-1 text-sm text-ink shadow-panel">
                              <button type="button" className="flex items-center gap-2 px-3 py-2 text-left hover:bg-ink/5" onClick={() => updateWorkspace((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item) }))}>{note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}{note.pinned ? "Lepas sematan" : "Sematkan"}</button>
                              <button type="button" className="flex items-center gap-2 px-3 py-2 text-left hover:bg-ink/5" onClick={() => openEdit("notes", note.id)}><Pencil className="h-4 w-4" />Ubah</button>
                              <button type="button" className="flex items-center gap-2 px-3 py-2 text-left text-red-700 hover:bg-red-50" onClick={() => remove("notes", note.id, note.title)}><Trash2 className="h-4 w-4" />Hapus</button>
                            </div>
                          </details>
                        </div>
                        <NoteContent note={note} onToggleChecklist={(line) => updateWorkspace((current) => ({ ...current, notes: current.notes.map((item) => item.id === note.id ? { ...item, content: toggleChecklistLine(item.content, line), updatedAt: new Date().toISOString() } : item) }))} />
                        <p className="mt-2 flex items-center justify-end gap-1 text-[10px] font-semibold text-[#5274a3] dark:text-blue-100/60"><span>{noteTimeLabel(note.updatedAt)}</span><span className="text-sky-600 dark:text-cyan-300" aria-label="Tersimpan">✓✓</span></p>
                      </article>
                    </Fragment>
                  );
                })}
                {visibleNotes.length === 0 ? <div className="grid min-h-52 place-items-center text-center"><div><NotebookPen className="mx-auto h-7 w-7 text-moss" /><p className="mt-3 text-sm font-semibold text-ink/55 dark:text-paper/60">{search ? "Tidak ada note yang cocok." : "Belum ada note. Tulis pesan pertama di bawah."}</p></div></div> : null}
              </div>

              <form className="sticky bottom-0 z-10 flex items-end gap-2 border-t border-ink/10 bg-[#edf4ff]/95 p-3 backdrop-blur dark:border-white/10 dark:bg-[#0b1f3a]/95" onSubmit={quickSaveNote}>
                <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/60 transition hover:bg-ink/5 dark:text-paper/60 dark:hover:bg-white/5" onClick={() => openCreate("notes")} aria-label="Buka form note lengkap"><Plus className="h-6 w-6" /></button>
                <label htmlFor="quick-note" className="sr-only">Tulis note</label>
                <textarea id="quick-note" name="quickNote" className="max-h-40 min-h-11 min-w-0 flex-1 resize-y rounded-2xl border border-line bg-white px-4 py-2.5 text-sm leading-6 text-ink outline-none focus:border-moss dark:border-white/10 dark:bg-white/10 dark:text-paper" rows={1} maxLength={20000} placeholder="Tulis note… Baris pertama menjadi judul" />
                <button type="submit" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-moss text-white transition hover:bg-blue-700" aria-label="Simpan note"><SendHorizontal className="h-5 w-5" /></button>
              </form>
            </div>
          </section>
        ) : null}

        {active === "sources" ? (
          <section className="grid gap-4">
            {formOpen ? (
              <Editor title={editingSource ? "Ubah sumber uang" : "Sumber uang baru"} onClose={closeForm}>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveSource} key={editingSource?.id ?? "new-source"}>
                  <Field label="Nama sumber" name="name" defaultValue={editingSource?.name} placeholder="Contoh: GoPay utama" maxLength={80} />
                  <label className="grid gap-2"><span className="label">Jenis</span><select className="field" name="type" defaultValue={editingSource?.type ?? "cash"}>{moneySourceTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                  <Field label="Saldo / nilai" name="balance" type="number" defaultValue={editingSource?.balance} min={0} step={1000} placeholder="0" />
                  <Field label="Jatuh tempo" name="dueDate" type="date" defaultValue={editingSource?.dueDate} />
                  <Field label="Cicilan / minimum bayar" name="installmentAmount" type="number" defaultValue={editingSource?.installmentAmount} min={0} step={1000} placeholder="Opsional" required={false} />
                  <label className="grid gap-2"><span className="label">Sumber pembayaran cicilan</span><select className="field" name="paymentSourceId" defaultValue={editingSource?.paymentSourceId ?? ""}><option value="">Tidak ada</option>{workspace.moneySources.filter(({ id }) => id !== editingSource?.id).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
                  <div className="self-end"><FormActions editing={Boolean(editingSource)} onCancel={closeForm} /></div>
                </form>
              </Editor>
            ) : null}
            <p className="text-sm text-ink/55 dark:text-paper/50">Kelola tunai, kartu, akun virtual, investasi, piutang, dan hutang di satu tempat.</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {workspace.moneySources.map((source) => (
                <article className="panel rounded-xl p-5" key={source.id}>
                  <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-moss/10 text-moss dark:text-emerald-300"><WalletCards className="h-5 w-5" /></span><RowActions onEdit={() => openEdit("sources", source.id)} onDelete={() => remove("sources", source.id, source.name)} /></div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">{moneySourceTypes.find(({ value }) => value === source.type)?.label}</p>
                  <h2 className="mt-1 text-lg font-black">{source.name}</h2>
                  <p className="mt-3 text-2xl font-black tracking-tight">{displayMoney(source.balance)}</p>
                  {source.dueDate ? <p className="mt-2 text-xs text-ink/50 dark:text-paper/50">Jatuh tempo {source.dueDate}{source.installmentAmount ? ` · ${displayMoney(source.installmentAmount)}` : ""}</p> : null}
                </article>
              ))}
              {workspace.moneySources.length === 0 ? <EmptyState icon={WalletCards} text="Belum ada sumber uang." onCreate={() => openCreate("sources")} /> : null}
            </div>
          </section>
        ) : null}

        {active === "goals" ? (
          <section className="grid gap-4">
            {formOpen ? (
              <Editor title={editingGoal ? "Ubah tujuan tabungan" : "Tujuan tabungan baru"} onClose={closeForm}>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveGoal} key={editingGoal?.id ?? "new-goal"}>
                  <Field label="Nama tujuan" name="name" defaultValue={editingGoal?.name} placeholder="Contoh: Dana liburan" maxLength={100} />
                  <label className="grid gap-2"><span className="label">Cara menabung</span><select className="field" name="mode" defaultValue={editingGoal?.mode ?? "flexible"}><option value="flexible">Fleksibel</option><option value="cycle">Secara siklus</option></select></label>
                  <Field label="Target" name="target" type="number" defaultValue={editingGoal?.target} min={1} step={1000} placeholder="10000000" />
                  <Field label="Sudah terkumpul" name="saved" type="number" defaultValue={editingGoal?.saved} min={0} step={1000} placeholder="0" />
                  <label className="grid gap-2"><span className="label">Siklus</span><select className="field" name="cycle" defaultValue={editingGoal?.cycle ?? "monthly"}><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option></select><span className="text-xs text-ink/40 dark:text-paper/40">Dipakai saat cara menabung “secara siklus”.</span></label>
                  <label className="grid gap-2"><span className="label">Sumber setoran</span><select className="field" name="sourceId" defaultValue={editingGoal?.sourceId ?? ""}><option value="">Pilih sumber</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
                  <Field label="Nominal otomatis" name="autoAmount" type="number" defaultValue={editingGoal?.autoAmount} min={0} step={1000} placeholder="Opsional" required={false} />
                  <Field label="Setoran berikutnya" name="nextContributionDate" type="date" defaultValue={editingGoal?.nextContributionDate} required={false} />
                  <div className="self-end"><FormActions editing={Boolean(editingGoal)} onCancel={closeForm} /></div>
                </form>
              </Editor>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {workspace.savingGoals.map((goal) => {
                const progress = Math.min(100, goal.target ? (goal.saved / goal.target) * 100 : 0);
                const forecast = goalForecast(goal);
                return (
                  <article className="panel rounded-xl p-5" key={goal.id}>
                    <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-clay/10 px-2.5 py-1 text-xs font-bold text-clay">{goal.mode === "flexible" ? "Fleksibel" : `Siklus ${goal.cycle === "weekly" ? "mingguan" : "bulanan"}`}</span><RowActions onEdit={() => openEdit("goals", goal.id)} onDelete={() => remove("goals", goal.id, goal.name)} /></div>
                    <h2 className="mt-5 text-lg font-black">{goal.name}</h2>
                    <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">{displayMoney(goal.saved)} dari {displayMoney(goal.target)}</p>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10"><div className="h-full rounded-full bg-clay" style={{ width: `${progress}%` }} /></div>
                    <p className="mt-2 text-right text-xs font-bold text-clay">{Math.round(progress)}%{goal.autoAmount && goal.nextContributionDate ? ` · berikutnya ${goal.nextContributionDate}` : ""}</p>
                    {forecast ? <p className="mt-1 text-right text-xs text-ink/45 dark:text-paper/45">Perkiraan tercapai {forecast}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => { const amount = Number(prompt("Nominal setoran")) || 0; const sourceId = goal.sourceId || workspace.moneySources[0]?.id; if (amount && sourceId) updateWorkspace((current) => moveGoalFunds(current, goal.id, "deposit", amount, sourceId)); }}>Setor</button><button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => { const amount = Number(prompt("Nominal penarikan")) || 0; const sourceId = goal.sourceId || workspace.moneySources[0]?.id; if (amount && sourceId) updateWorkspace((current) => moveGoalFunds(current, goal.id, "withdrawal", amount, sourceId)); }}>Tarik</button><span className="self-center text-xs text-ink/40 dark:text-paper/40">{goal.movements?.length ?? 0} riwayat</span></div>
                  </article>
                );
              })}
              {workspace.savingGoals.length === 0 ? <EmptyState icon={PiggyBank} text="Belum ada tujuan tabungan fleksibel atau siklus." onCreate={() => openCreate("goals")} /> : null}
            </div>
          </section>
        ) : null}

        {active === "recurring" ? (
          <section className="grid gap-4">
            {formOpen ? (
              <Editor title={editingRecurring ? "Ubah transaksi berkala" : "Transaksi berkala baru"} onClose={closeForm}>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveRecurring} key={editingRecurring?.id ?? "new-recurring"}>
                  <Field label="Nama" name="name" defaultValue={editingRecurring?.name} placeholder="Contoh: Internet rumah" maxLength={100} />
                  <label className="grid gap-2"><span className="label">Jenis</span><select className="field" name="kind" defaultValue={editingRecurring?.kind ?? "payment"}><option value="payment">Pembayaran berkala</option><option value="transfer">Transfer berkala</option></select></label>
                  <Field label="Nominal" name="amount" type="number" defaultValue={editingRecurring?.amount} min={1} step={1000} placeholder="0" />
                  <label className="grid gap-2"><span className="label">Frekuensi</span><select className="field" name="frequency" defaultValue={editingRecurring?.frequency ?? "monthly"}><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option><option value="yearly">Tahunan</option></select></label>
                  <Field label="Jadwal berikutnya" name="nextDate" type="date" defaultValue={editingRecurring?.nextDate ?? dateInputValue()} />
                  <label className="grid gap-2"><span className="label">Sumber uang</span><select className="field" name="sourceId" defaultValue={editingRecurring?.sourceId ?? ""}><option value="">Belum ditentukan</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
                  <label className="grid gap-2"><span className="label">Tujuan transfer</span><select className="field" name="destinationSourceId" defaultValue={editingRecurring?.destinationSourceId ?? ""}><option value="">Tidak ada</option>{workspace.moneySources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
                  <label className="grid gap-2"><span className="label">Kategori</span><select className="field" name="categoryId" defaultValue={editingRecurring?.categoryId ?? ""}><option value="">Tanpa kategori</option>{workspace.categoryGroups.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  <Field label="Penerima / tujuan" name="destination" defaultValue={editingRecurring?.destination} placeholder="PLN, rekening tujuan, dll." maxLength={100} />
                  <label className="flex items-center gap-2 self-end text-sm font-bold"><input type="checkbox" name="autoPost" defaultChecked={editingRecurring?.autoPost} /> Posting otomatis saat jatuh tempo</label>
                  <div className="self-end"><FormActions editing={Boolean(editingRecurring)} onCancel={closeForm} /></div>
                </form>
              </Editor>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {workspace.recurringItems.map((item) => (
                <article className="panel rounded-xl p-5" key={item.id}>
                  <div className="flex items-start justify-between gap-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", item.kind === "payment" ? "bg-clay/10 text-clay" : "bg-moss/10 text-moss dark:text-emerald-300")}>{item.kind === "payment" ? "Pembayaran" : "Transfer"}</span><RowActions onEdit={() => openEdit("recurring", item.id)} onDelete={() => remove("recurring", item.id, item.name)} /></div>
                  <h2 className="mt-5 text-lg font-black">{item.name}</h2>
                  <p className="mt-1 text-sm text-ink/50 dark:text-paper/50">ke {item.destination} · {item.frequency === "weekly" ? "mingguan" : item.frequency === "monthly" ? "bulanan" : "tahunan"}</p>
                  <div className="mt-5 flex items-end justify-between gap-3"><p className="text-xl font-black">{displayMoney(item.amount)}</p><p className="text-xs font-semibold text-ink/45 dark:text-paper/45">Berikutnya {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(`${item.nextDate}T00:00:00`))}</p></div>
                  <p className="mt-3 border-t border-line pt-3 text-xs text-ink/45 dark:border-white/10 dark:text-paper/45">Sumber: {workspace.moneySources.find(({ id }) => id === item.sourceId)?.name ?? "Belum ditentukan"}</p>
                  <div className="mt-3 flex items-center justify-between gap-2"><span className={cn("text-xs font-bold", item.nextDate < dateInputValue() ? "text-clay" : "text-moss")}>{item.nextDate < dateInputValue() ? "Terlambat" : item.autoPost ? "Otomatis" : "Menunggu pembayaran"}</span><button type="button" className="button-secondary px-3 py-1.5 text-xs" onClick={() => payRecurring(item)}>Tandai dibayar</button></div>
                </article>
              ))}
              {workspace.recurringItems.length === 0 ? <EmptyState icon={CalendarClock} text="Belum ada pembayaran atau transfer berkala." onCreate={() => openCreate("recurring")} /> : null}
            </div>
          </section>
        ) : null}

        {active === "categories" ? (
          <section className="grid gap-4">
            {formOpen ? (
              <Editor title={editingCategory ? "Ubah grup kategori" : "Grup kategori baru"} onClose={closeForm}>
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveCategory} key={editingCategory?.id ?? "new-category"}>
                  <Field label="Nama grup" name="name" defaultValue={editingCategory?.name} placeholder="Contoh: Kebutuhan rumah" maxLength={80} />
                  <label className="grid gap-2"><span className="label">Kategori utama</span><select className="field" name="kind" defaultValue={editingCategory?.kind ?? "expense"}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option></select></label>
                  <Field label="Anggaran bulanan" name="monthlyBudget" type="number" defaultValue={editingCategory?.monthlyBudget} min={0} step={100000} placeholder="Opsional" required={false} />
                  <div className="sm:col-span-2"><FormActions editing={Boolean(editingCategory)} onCancel={closeForm} /></div>
                </form>
              </Editor>
            ) : null}
            <p className="text-sm text-ink/55 dark:text-paper/50">Dua kategori utama tetap: pengeluaran dan pemasukan. Di bawahnya, grup dapat ditambah, diubah, atau dihapus.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {(["expense", "income"] as const).map((kind) => (
                <article className="panel rounded-xl p-5" key={kind}>
                  <div className="flex items-center gap-3"><span className={cn("grid h-10 w-10 place-items-center rounded-xl", kind === "expense" ? "bg-clay/10 text-clay" : "bg-moss/10 text-moss dark:text-emerald-300")}>{kind === "expense" ? <ReceiptText className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}</span><div><p className="text-xs font-bold uppercase tracking-wide text-ink/45 dark:text-paper/45">Kategori utama</p><h2 className="font-black">{kind === "expense" ? "Pengeluaran" : "Pemasukan"}</h2></div></div>
                  <div className="mt-5 grid gap-2">
                    {workspace.categoryGroups.filter((group) => group.kind === kind).map((group) => {
                      const spent = workspace.transactions.filter((item) => item.kind === "expense" && item.categoryId === group.id && item.date.startsWith(dateInputValue().slice(0, 7))).reduce((sum, item) => sum + item.amount, 0);
                      const progress = group.monthlyBudget ? Math.min(100, (spent / group.monthlyBudget) * 100) : 0;
                      return <div className="rounded-lg border border-line bg-white p-3 dark:border-white/10 dark:bg-white/5" key={group.id}><div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">{group.name}</span><RowActions onEdit={() => openEdit("categories", group.id)} onDelete={() => remove("categories", group.id, group.name)} /></div>{group.monthlyBudget ? <><p className="mt-2 text-xs text-ink/45 dark:text-paper/45">{displayMoney(spent)} / {displayMoney(group.monthlyBudget)}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10"><div className={`h-full rounded-full ${progress >= 90 ? "bg-clay" : "bg-moss"}`} style={{ width: `${progress}%` }} /></div></> : null}</div>;
                    })}
                    {workspace.categoryGroups.every((group) => group.kind !== kind) ? <EmptyLine text="Belum ada grup." /> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {active === "agenda" ? <AgendaPanel workspace={workspace} updateWorkspace={updateWorkspace} /> : null}
        {active === "transaksi" ? <TransactionsPanel workspace={workspace} updateWorkspace={updateWorkspace} hideBalances={workspace.settings.hideBalances} /> : null}
        {active === "kebiasaan" ? <WorkspaceHabits workspace={workspace} updateWorkspace={updateWorkspace} /> : null}
        {active === "perkembangan" ? <GrowthCenter workspace={workspace} updateWorkspace={updateWorkspace} /> : null}
        {active === "proyek" ? <KanbanBoard workspace={workspace} updateWorkspace={updateWorkspace} /> : null}
        {active === "pengaturan" ? <WorkspaceSettings workspace={workspace} updateWorkspace={updateWorkspace} syncState={syncState} conflict={Boolean(remoteConflict)} onUseRemote={useRemoteWorkspace} onKeepLocal={keepLocalWorkspace} onEnableNotifications={enableNotifications} onResetWorkspace={resetWorkspace} /> : null}
      </div>
    </main>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-paper/90 p-6 backdrop-blur lg:flex lg:flex-col dark:border-white/10 dark:bg-[#061225]/90">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">Personal</p><h1 className="mt-1 text-xl font-black">Command Center</h1></div>
        <nav className="mt-8 grid gap-1 overflow-y-auto" aria-label="Navigasi dashboard">
          {dashboardNavigation.map((section) => { const Icon = section.icon; return <button type="button" key={section.id} onClick={() => changeSection(section.id)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-bold transition", navigationActive === section.id ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "text-ink/60 hover:bg-white hover:text-ink dark:text-paper/60 dark:hover:bg-white/5 dark:hover:text-paper")}><Icon className="h-4 w-4" />{section.label}</button>; })}
        </nav>
        <div className="mt-auto rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-white/5"><p className="text-sm font-black">Semua perangkat</p><p className="mt-1 text-xs leading-5 text-ink/45 dark:text-paper/45">Web/PWA dan Windows memakai workspace Supabase yang sama dengan cache offline lokal.</p></div>
      </aside>
      <div className="border-b border-line bg-white/80 px-4 py-3 lg:hidden dark:border-white/10 dark:bg-white/5"><p className="font-black">Command Center</p><nav className="mt-3 grid gap-1" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>{dashboardNavigation.map((section) => { const Icon = section.icon; return <button type="button" key={section.id} onClick={() => changeSection(section.id)} className={cn("flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold", navigationActive === section.id ? "bg-ink text-paper dark:bg-paper dark:text-ink" : "bg-white text-ink/55 dark:bg-white/5 dark:text-paper/55")}><Icon className="h-4 w-4 shrink-0" /><span className="truncate">{section.id === "perkembangan" ? "Tumbuh" : section.label}</span></button>; })}</nav></div>
      {page}
      <QuickCapture workspace={workspace} updateWorkspace={updateWorkspace} />
    </div>
  );
}

function Field({ label, name, defaultValue, ...props }: { label: string; name: string; defaultValue?: string | number; [key: string]: unknown }) {
  return <label className="grid gap-2"><span className="label">{label}</span><input className="field" name={name} defaultValue={defaultValue} required {...props} /></label>;
}

function Editor({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="panel rounded-xl p-5"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-clay">Editor</p><h2 className="mt-1 text-lg font-black">{title}</h2></div><IconButton label="Tutup editor" onClick={onClose}><X className="h-4 w-4" /></IconButton></div>{children}</div>;
}

function FormActions({ editing, onCancel }: { editing: boolean; onCancel: () => void }) {
  return <div className="flex flex-wrap gap-2"><button className="button-primary" type="submit">{editing ? "Simpan perubahan" : "Tambahkan"}</button><button className="button-secondary" type="button" onClick={onCancel}>Batal</button></div>;
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button className={danger ? "button-danger px-2.5" : "button-secondary px-2.5"} type="button" onClick={onClick} aria-label={label} title={label}>{children}</button>;
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex shrink-0 gap-1"><IconButton label="Ubah" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></IconButton><IconButton danger label="Hapus" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></IconButton></div>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-line p-4 text-sm text-ink/45 dark:border-white/10 dark:text-paper/45">{text}</p>;
}

function EmptyState({ icon: Icon, text, onCreate }: { icon: typeof NotebookPen; text: string; onCreate: () => void }) {
  return <div className="panel grid min-h-52 place-items-center rounded-xl p-6 text-center"><div><Icon className="mx-auto h-7 w-7 text-clay" /><p className="mx-auto mt-3 max-w-sm text-sm text-ink/55 dark:text-paper/50">{text}</p><button type="button" className="button-primary mt-4" onClick={onCreate}><Plus className="h-4 w-4" />Tambah sekarang</button></div></div>;
}

function toggleChecklistLine(content: string, lineNumber: number) {
  return content.split("\n").map((line, index) => {
    if (index !== lineNumber) return line;
    return line.startsWith("☑ ") ? `☐ ${line.slice(2)}` : `☑ ${line.slice(2)}`;
  }).join("\n");
}

function noteDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function noteDateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (noteDayKey(value) === noteDayKey(today.toISOString())) return "Hari ini";
  if (noteDayKey(value) === noteDayKey(yesterday.toISOString())) return "Kemarin";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(date);
}

function noteTimeLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)).replace(".", ":");
}

function NoteContent({ note, onToggleChecklist }: { note: Note; onToggleChecklist: (line: number) => void }) {
  if (!note.content) return null;
  return <div className="mt-2 grid gap-0.5 text-sm leading-6 sm:text-[15px]">{note.content.split("\n").map((line, index) => /^☐ |^☑ /.test(line) ? <button type="button" className="flex items-start gap-2 text-left hover:opacity-70" key={`${index}-${line}`} onClick={() => onToggleChecklist(index)}><span className="font-bold">{line.slice(0, 1)}</span><span>{line.slice(2)}</span></button> : <p className="whitespace-pre-wrap break-words" key={`${index}-${line}`}>{line || " "}</p>)}</div>;
}

function NoteEditorField({ defaultValue }: { defaultValue?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function apply(style: NoteListStyle) {
    const textarea = ref.current;
    if (!textarea) return;
    const result = formatNoteList(textarea.value, textarea.selectionStart, textarea.selectionEnd, style);
    textarea.value = result.value;
    textarea.focus();
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
  }
  return <label className="grid gap-2"><span className="flex items-center justify-between gap-3"><span className="label">Isi note</span><span className="flex gap-1"><button type="button" className="button-secondary px-2 py-1" onClick={() => apply("bullet")} aria-label="Daftar bullet"><List className="h-4 w-4" /></button><button type="button" className="button-secondary px-2 py-1" onClick={() => apply("numbered")} aria-label="Daftar bernomor"><ListOrdered className="h-4 w-4" /></button><button type="button" className="button-secondary px-2 py-1" onClick={() => apply("checklist")} aria-label="Checklist"><ListChecks className="h-4 w-4" /></button></span></span><textarea ref={ref} className="field min-h-44 resize-y leading-6" name="content" defaultValue={defaultValue} maxLength={20000} placeholder="Tulis bebas, daftar, atau checklist…" /></label>;
}
