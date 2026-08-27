import {
  type GoalMovement,
  type MoneySource,
  type OfflineWorkspace,
  type RecurringItem,
  type Transaction,
  upsertById
} from "@/lib/offline-workspace";

const liabilityTypes = new Set(["credit_card", "debt"]);

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dateOnly(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function adjustSource(sources: MoneySource[], sourceId: string | undefined, amount: number) {
  if (!sourceId || amount === 0) return sources;
  return sources.map((source) => source.id === sourceId ? { ...source, balance: source.balance + amount } : source);
}

function sourceDelta(source: MoneySource | undefined, amount: number, direction: 1 | -1) {
  return (source && liabilityTypes.has(source.type) ? amount : -amount) * direction;
}

export function applyTransactionToSources(
  sources: MoneySource[],
  transaction: Transaction,
  direction: 1 | -1 = 1
) {
  const source = sources.find(({ id }) => id === transaction.sourceId);
  let next = sources;

  if (transaction.kind === "income") {
    next = adjustSource(next, transaction.sourceId, -sourceDelta(source, transaction.amount, direction));
  } else {
    next = adjustSource(next, transaction.sourceId, sourceDelta(source, transaction.amount, direction));
  }

  if (transaction.kind === "transfer" && transaction.destinationSourceId) {
    const destination = sources.find(({ id }) => id === transaction.destinationSourceId);
    next = adjustSource(next, transaction.destinationSourceId, -sourceDelta(destination, transaction.amount, direction));
  }

  return next;
}

function applyGoalTransfer(workspace: OfflineWorkspace, transaction: Transaction, direction: 1 | -1) {
  return workspace.savingGoals.map((goal) => {
    if (goal.id === transaction.destinationGoalId) {
      return { ...goal, saved: Math.max(0, goal.saved + transaction.amount * direction) };
    }
    if (goal.id === transaction.sourceGoalId) {
      return { ...goal, saved: Math.max(0, goal.saved - transaction.amount * direction) };
    }
    return goal;
  });
}

export function putTransaction(
  workspace: OfflineWorkspace,
  transaction: Transaction,
  previous?: Transaction
): OfflineWorkspace {
  const revertedSources = previous
    ? applyTransactionToSources(workspace.moneySources, previous, -1)
    : workspace.moneySources;
  const revertedGoals = previous ? applyGoalTransfer({ ...workspace, savingGoals: workspace.savingGoals }, previous, -1) : workspace.savingGoals;
  const base = { ...workspace, moneySources: revertedSources, savingGoals: revertedGoals };

  return {
    ...base,
    moneySources: applyTransactionToSources(base.moneySources, transaction),
    savingGoals: applyGoalTransfer(base, transaction, 1),
    transactions: upsertById(base.transactions, transaction)
  };
}

export function removeTransaction(workspace: OfflineWorkspace, transactionId: string): OfflineWorkspace {
  const transaction = workspace.transactions.find(({ id }) => id === transactionId);
  if (!transaction) return workspace;
  return {
    ...workspace,
    moneySources: applyTransactionToSources(workspace.moneySources, transaction, -1),
    savingGoals: applyGoalTransfer(workspace, transaction, -1).map((goal) => ({
      ...goal,
      movements: transaction.goalMovementId ? goal.movements?.filter(({ id }) => id !== transaction.goalMovementId) : goal.movements
    })),
    transactions: workspace.transactions.filter(({ id }) => id !== transactionId)
  };
}

export function moveGoalFunds(
  workspace: OfflineWorkspace,
  goalId: string,
  kind: GoalMovement["kind"],
  amount: number,
  sourceId: string,
  movementDate = dateOnly()
) {
  const goal = workspace.savingGoals.find(({ id }) => id === goalId);
  if (!goal || amount <= 0) return workspace;
  const safeAmount = kind === "withdrawal" ? Math.min(amount, goal.saved) : amount;
  const source = workspace.moneySources.find(({ id: currentId }) => currentId === sourceId);
  if (!source || safeAmount <= 0 || (kind === "deposit" && !liabilityTypes.has(source.type) && source.balance < safeAmount)) return workspace;
  const movement: GoalMovement = { id: id(), kind, amount: safeAmount, date: movementDate };
  const transaction: Transaction = {
    id: id(),
    kind: kind === "deposit" ? "transfer" : "income",
    amount: safeAmount,
    date: movementDate,
    sourceId,
    destinationGoalId: kind === "deposit" ? goalId : undefined,
    sourceGoalId: kind === "withdrawal" ? goalId : undefined,
    goalMovementId: movement.id,
    note: `${kind === "deposit" ? "Setoran" : "Penarikan"} ${goal.name}`,
    createdAt: new Date().toISOString()
  };
  const next = putTransaction(workspace, transaction);

  return {
    ...next,
    savingGoals: next.savingGoals.map((current) => current.id === goalId ? {
      ...current,
      movements: [movement, ...(current.movements ?? [])]
    } : current)
  };
}

export function advanceRecurringDate(value: string, frequency: RecurringItem["frequency"]) {
  const next = new Date(`${value}T12:00:00`);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "monthly") {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
  } else {
    const month = next.getMonth();
    const day = next.getDate();
    next.setDate(1);
    next.setFullYear(next.getFullYear() + 1);
    next.setMonth(month);
    next.setDate(Math.min(day, new Date(next.getFullYear(), month + 1, 0).getDate()));
  }
  return dateOnly(next);
}

export function runWorkspaceAutomation(workspace: OfflineWorkspace, today = dateOnly()) {
  let next = workspace;
  let changed = false;

  for (const recurring of workspace.recurringItems) {
    if (!recurring.autoPost) continue;
    let dueDate = recurring.nextDate;
    let runs = 0;
    // ponytail: cap catch-up at 36 cycles; use a background job if multi-year backlogs matter.
    while (dueDate <= today && runs < 36) {
      const transaction: Transaction = {
        id: id(),
        kind: recurring.kind === "transfer" ? "transfer" : "expense",
        amount: recurring.amount,
        date: dueDate,
        sourceId: recurring.sourceId,
        destinationSourceId: recurring.destinationSourceId,
        categoryId: recurring.categoryId,
        note: recurring.name,
        recurringItemId: recurring.id,
        createdAt: new Date().toISOString()
      };
      next = putTransaction(next, transaction);
      dueDate = advanceRecurringDate(dueDate, recurring.frequency);
      runs += 1;
      changed = true;
    }
    if (runs > 0) {
      next = {
        ...next,
        recurringItems: next.recurringItems.map((item) => item.id === recurring.id
          ? { ...item, nextDate: dueDate, lastPaidDate: today }
          : item)
      };
    }
  }

  for (const goal of workspace.savingGoals) {
    if (goal.mode !== "cycle" || !goal.autoAmount || !goal.nextContributionDate || !goal.sourceId) continue;
    let dueDate = goal.nextContributionDate;
    let runs = 0;
    while (dueDate <= today && runs < 36) {
      const currentSource = next.moneySources.find(({ id: sourceId }) => sourceId === goal.sourceId);
      if (!currentSource || (!liabilityTypes.has(currentSource.type) && currentSource.balance < goal.autoAmount)) break;
      next = moveGoalFunds(next, goal.id, "deposit", goal.autoAmount, goal.sourceId, dueDate);
      dueDate = advanceRecurringDate(dueDate, goal.cycle === "weekly" ? "weekly" : "monthly");
      runs += 1;
      changed = true;
    }
    if (runs > 0) {
      next = {
        ...next,
        savingGoals: next.savingGoals.map((item) => item.id === goal.id
          ? { ...item, nextContributionDate: dueDate }
          : item)
      };
    }
  }

  return { workspace: next, changed };
}
