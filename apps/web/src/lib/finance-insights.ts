import type {
  BudgetPlan,
  CategoryGroup,
  InvestmentHolding,
  MoneySource,
  OfflineWorkspace,
  ReconciliationRecord,
  Transaction
} from "@/lib/offline-workspace";

const liabilityTypes = new Set(["credit_card", "debt"]);
const liquidTypes = new Set(["cash", "deposit_card", "virtual_account"]);

export function monthKey(value: Date | string = new Date()) {
  if (typeof value === "string") return value.slice(0, 7);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + offset, 1);
  return monthKey(date);
}

export function transactionsForMonth(workspace: OfflineWorkspace, month: string) {
  return workspace.transactions.filter((item) => item.date.startsWith(month));
}

function categoryAmounts(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.kind !== "expense") continue;
    if (transaction.splits?.length) {
      for (const split of transaction.splits) totals.set(split.categoryId ?? "uncategorized", (totals.get(split.categoryId ?? "uncategorized") ?? 0) + split.amount);
    } else {
      totals.set(transaction.categoryId ?? "uncategorized", (totals.get(transaction.categoryId ?? "uncategorized") ?? 0) + transaction.amount);
    }
  }
  return totals;
}

export function financeReport(workspace: OfflineWorkspace, month: string) {
  const transactions = transactionsForMonth(workspace, month);
  const previous = transactionsForMonth(workspace, shiftMonth(month, -1));
  const total = (rows: Transaction[], kind: Transaction["kind"]) => rows.filter((item) => item.kind === kind).reduce((sum, item) => sum + item.amount, 0);
  const income = total(transactions, "income");
  const expense = total(transactions, "expense");
  const previousIncome = total(previous, "income");
  const previousExpense = total(previous, "expense");
  const categories = categoryAmounts(transactions);
  const categoryBreakdown = [...categories].map(([categoryId, amount]) => ({
    categoryId,
    name: workspace.categoryGroups.find(({ id }) => id === categoryId)?.name ?? "Tanpa kategori",
    amount,
    share: expense ? amount / expense : 0
  })).sort((a, b) => b.amount - a.amount);
  const daily = new Map<string, { date: string; income: number; expense: number }>();
  for (const item of transactions) {
    const row = daily.get(item.date) ?? { date: item.date, income: 0, expense: 0 };
    if (item.kind === "income") row.income += item.amount;
    if (item.kind === "expense") row.expense += item.amount;
    daily.set(item.date, row);
  }
  return {
    month,
    income,
    expense,
    net: income - expense,
    savingsRate: income ? (income - expense) / income : 0,
    previous: { income: previousIncome, expense: previousExpense, net: previousIncome - previousExpense },
    categoryBreakdown,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date))
  };
}

export function yearlyFinanceReport(workspace: OfflineWorkspace, year: string) {
  const months = Array.from({ length: 12 }, (_, index) => financeReport(workspace, `${year}-${String(index + 1).padStart(2, "0")}`));
  const income = months.reduce((sum, item) => sum + item.income, 0);
  const expense = months.reduce((sum, item) => sum + item.expense, 0);
  return { year, months, income, expense, net: income - expense, savingsRate: income ? (income - expense) / income : 0 };
}

function planFor(workspace: OfflineWorkspace, month: string, category: CategoryGroup): BudgetPlan | undefined {
  return workspace.budgetPlans.find((item) => item.month === month && item.categoryId === category.id);
}

export function budgetReport(workspace: OfflineWorkspace, month: string) {
  const spent = categoryAmounts(transactionsForMonth(workspace, month));
  const previousMonth = shiftMonth(month, -1);
  const previousSpent = categoryAmounts(transactionsForMonth(workspace, previousMonth));
  const rows = workspace.categoryGroups.filter(({ kind }) => kind === "expense").map((category) => {
    const plan = planFor(workspace, month, category);
    const previousPlan = planFor(workspace, previousMonth, category);
    const base = plan?.planned ?? category.monthlyBudget ?? 0;
    const automaticRollover = workspace.settings.budgetRollover
      ? Math.max(0, (previousPlan?.planned ?? category.monthlyBudget ?? 0) + (previousPlan?.rollover ?? 0) - (previousSpent.get(category.id) ?? 0))
      : 0;
    const rollover = plan?.rollover ?? automaticRollover;
    const limit = base + rollover;
    const actual = spent.get(category.id) ?? 0;
    return { categoryId: category.id, name: category.name, planned: base, rollover, limit, actual, remaining: limit - actual, progress: limit ? actual / limit : 0 };
  });
  const planned = rows.reduce((sum, item) => sum + item.limit, 0);
  const actual = rows.reduce((sum, item) => sum + item.actual, 0) + (spent.get("uncategorized") ?? 0);
  return { month, rows, planned, actual, remaining: planned - actual, unallocated: Math.max(0, financeReport(workspace, month).income - planned) };
}

function dateOnly(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function advance(value: string, frequency: "weekly" | "monthly" | "yearly") {
  const date = new Date(`${value}T12:00:00`);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "monthly") {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  } else {
    const month = date.getMonth();
    const day = date.getDate();
    date.setDate(1);
    date.setFullYear(date.getFullYear() + 1);
    date.setMonth(month);
    date.setDate(Math.min(day, new Date(date.getFullYear(), month + 1, 0).getDate()));
  }
  return dateOnly(date);
}

function monthDate(month: string, day: number) {
  const [year, value] = month.split("-").map(Number);
  const lastDay = new Date(year, value, 0).getDate();
  return `${month}-${String(Math.min(Math.max(1, day), lastDay)).padStart(2, "0")}`;
}

export function paydayPlan(workspace: OfflineWorkspace, month: string) {
  const grouped = new Map<string, number>();
  for (const payday of workspace.settings.paydays) {
    const date = monthDate(month, payday.day);
    grouped.set(date, (grouped.get(date) ?? 0) + payday.amount);
  }
  const rows = [...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([date, salary]) => ({
    date,
    salary,
    obligations: [] as Array<{ id: string; label: string; date: string; amount: number; kind: "bill" | "debt" | "saving"; needsReserve: boolean }>,
    committed: 0,
    remaining: salary
  }));
  const start = monthDate(month, 1);
  const end = monthDate(month, 31);
  const obligations: Array<{ id: string; label: string; date: string; amount: number; kind: "bill" | "debt" | "saving" }> = [];
  const linkedDebts = new Set<string>();

  for (const item of workspace.recurringItems) {
    let cursor = item.nextDate;
    let runs = 0;
    while (cursor < start && runs < 120) { cursor = advance(cursor, item.frequency); runs += 1; }
    while (cursor <= end && runs < 120) {
      const debt = workspace.moneySources.find(({ id, type }) => id === item.destinationSourceId && liabilityTypes.has(type));
      if (debt) linkedDebts.add(debt.id);
      obligations.push({ id: `${item.id}:${cursor}`, label: item.name, date: cursor, amount: item.amount, kind: debt ? "debt" : "bill" });
      cursor = advance(cursor, item.frequency);
      runs += 1;
    }
  }
  for (const goal of workspace.savingGoals) {
    if (goal.mode !== "cycle" || !goal.autoAmount || !goal.nextContributionDate) continue;
    let cursor = goal.nextContributionDate;
    let runs = 0;
    while (cursor < start && runs < 120) { cursor = advance(cursor, goal.cycle === "weekly" ? "weekly" : "monthly"); runs += 1; }
    while (cursor <= end && runs < 120) {
      obligations.push({ id: `${goal.id}:${cursor}`, label: `Tabungan ${goal.name}`, date: cursor, amount: goal.autoAmount, kind: "saving" });
      cursor = advance(cursor, goal.cycle === "weekly" ? "weekly" : "monthly");
      runs += 1;
    }
  }
  for (const debt of workspace.moneySources.filter(({ id, type }) => liabilityTypes.has(type) && !linkedDebts.has(id))) {
    const payment = debt.minimumPayment ?? debt.installmentAmount ?? 0;
    if (!payment || !debt.dueDate || month < monthKey(debt.dueDate)) continue;
    obligations.push({ id: `debt:${debt.id}`, label: `Bayar ${debt.name}`, date: monthDate(month, Number(debt.dueDate.slice(8, 10))), amount: payment, kind: "debt" });
  }

  for (const obligation of obligations.sort((left, right) => left.date.localeCompare(right.date))) {
    if (!rows.length) continue;
    const previousPayday = rows.findLastIndex(({ date }) => date <= obligation.date);
    const index = previousPayday < 0 ? 0 : previousPayday;
    rows[index].obligations.push({ ...obligation, needsReserve: previousPayday < 0 });
    rows[index].committed += obligation.amount;
    rows[index].remaining -= obligation.amount;
  }

  return {
    rows,
    totalIncome: rows.reduce((sum, row) => sum + row.salary, 0),
    totalObligations: obligations.reduce((sum, item) => sum + item.amount, 0)
  };
}

export function cashFlowForecast(workspace: OfflineWorkspace, start = dateOnly(new Date()), days = 90) {
  const end = new Date(`${start}T12:00:00`);
  end.setDate(end.getDate() + Math.max(1, Math.min(days, 366)));
  const endValue = dateOnly(end);
  const events = new Map<string, Array<{ label: string; amount: number }>>();
  const add = (date: string, label: string, amount: number) => events.set(date, [...(events.get(date) ?? []), { label, amount }]);
  let salaryMonth = monthKey(start);
  const finalMonth = monthKey(endValue);
  while (salaryMonth <= finalMonth) {
    workspace.settings.paydays.forEach((payday, index) => {
      const date = monthDate(salaryMonth, payday.day);
      if (payday.amount > 0 && date >= start && date <= endValue) add(date, `Gajian ${index + 1}`, payday.amount);
    });
    salaryMonth = shiftMonth(salaryMonth, 1);
  }
  const linkedDebts = new Set<string>();
  for (const item of workspace.recurringItems) {
    let cursor = item.nextDate;
    let runs = 0;
    while (cursor <= endValue && runs < 60) {
      if (cursor >= start) {
        const source = workspace.moneySources.find(({ id }) => id === item.sourceId);
        const destination = workspace.moneySources.find(({ id }) => id === item.destinationSourceId);
        if (destination && liabilityTypes.has(destination.type)) linkedDebts.add(destination.id);
        const sourceLiquid = Boolean(source && liquidTypes.has(source.type));
        const destinationLiquid = Boolean(destination && liquidTypes.has(destination.type));
        const change = item.kind === "payment"
          ? sourceLiquid ? -item.amount : 0
          : (sourceLiquid ? -item.amount : 0) + (destinationLiquid ? item.amount : 0);
        add(cursor, item.name, change);
      }
      cursor = advance(cursor, item.frequency);
      runs += 1;
    }
  }
  for (const debt of workspace.moneySources.filter(({ id, type }) => liabilityTypes.has(type) && !linkedDebts.has(id))) {
    const payment = debt.minimumPayment ?? debt.installmentAmount ?? 0;
    if (!payment || !debt.dueDate) continue;
    let cursor = debt.dueDate;
    let runs = 0;
    while (cursor <= endValue && runs < 60) {
      if (cursor >= start) add(cursor, `Bayar ${debt.name}`, -payment);
      cursor = advance(cursor, "monthly");
      runs += 1;
    }
  }
  for (const goal of workspace.savingGoals) {
    if (goal.mode !== "cycle" || !goal.autoAmount || !goal.nextContributionDate) continue;
    let cursor = goal.nextContributionDate;
    let runs = 0;
    while (cursor <= endValue && runs < 60) {
      if (cursor >= start) add(cursor, `Tabungan ${goal.name}`, -goal.autoAmount);
      cursor = advance(cursor, goal.cycle === "weekly" ? "weekly" : "monthly");
      runs += 1;
    }
  }
  let balance = workspace.moneySources.filter(({ type }) => liquidTypes.has(type)).reduce((sum, item) => sum + item.balance, 0);
  const rows: Array<{ date: string; balance: number; change: number; events: string[] }> = [];
  const cursor = new Date(`${start}T12:00:00`);
  while (dateOnly(cursor) <= endValue) {
    const date = dateOnly(cursor);
    const changes = events.get(date) ?? [];
    const change = changes.reduce((sum, item) => sum + item.amount, 0);
    balance += change;
    rows.push({ date, balance, change, events: changes.map(({ label }) => label) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

export function debtProjection(source: MoneySource, extraPayment = 0) {
  let balance = Math.abs(source.balance);
  const monthlyRate = Math.max(0, source.annualInterestRate ?? 0) / 1200;
  const payment = Math.max(0, source.minimumPayment ?? source.installmentAmount ?? 0) + Math.max(0, extraPayment);
  const schedule: Array<{ month: number; payment: number; principal: number; interest: number; balance: number }> = [];
  let totalInterest = 0;
  if (!balance || !payment || payment <= balance * monthlyRate) return { schedule, payoffMonths: null, totalInterest, payment };
  for (let month = 1; balance > 0.01 && month <= 600; month += 1) {
    const interest = balance * monthlyRate;
    const paid = Math.min(payment, balance + interest);
    const principal = paid - interest;
    balance = Math.max(0, balance - principal);
    totalInterest += interest;
    schedule.push({ month, payment: paid, principal, interest, balance });
  }
  return { schedule, payoffMonths: schedule.length, totalInterest, payment };
}

export function investmentSummary(holdings: InvestmentHolding[]) {
  const cost = holdings.reduce((sum, item) => sum + item.units * item.costBasis, 0);
  const value = holdings.reduce((sum, item) => sum + item.units * item.currentPrice, 0);
  const dividends = holdings.reduce((sum, item) => sum + (item.dividends ?? 0), 0);
  return { cost, value, dividends, gain: value - cost + dividends, returnRate: cost ? (value - cost + dividends) / cost : 0 };
}

export function netWorth(workspace: OfflineWorkspace) {
  const hasDetailedInvestments = workspace.investments.length > 0;
  const assets = workspace.moneySources.filter(({ type }) => !liabilityTypes.has(type) && (!hasDetailedInvestments || type !== "investment")).reduce((sum, item) => sum + item.balance, 0);
  const liabilities = workspace.moneySources.filter(({ type }) => liabilityTypes.has(type)).reduce((sum, item) => sum + Math.abs(item.balance), 0);
  const investments = investmentSummary(workspace.investments).value;
  return { assets: assets + investments, liabilities, net: assets + investments - liabilities };
}

export function categorySuggestion(workspace: OfflineWorkspace, value: string) {
  const normalized = value.toLocaleLowerCase("id-ID");
  const keyword = workspace.categoryGroups.find((category) => category.keywords?.some((item) => normalized.includes(item.toLocaleLowerCase("id-ID"))));
  if (keyword) return keyword.id;
  const previous = [...workspace.transactions].reverse().find((item) => item.categoryId && `${item.payee ?? ""} ${item.note}`.trim().toLocaleLowerCase("id-ID") === normalized.trim());
  return previous?.categoryId;
}

export function financialInsights(workspace: OfflineWorkspace, month: string) {
  const report = financeReport(workspace, month);
  const budget = budgetReport(workspace, month);
  const worth = netWorth(workspace);
  const messages: string[] = [];
  if (report.net < 0) messages.push("Pengeluaran bulan ini lebih besar daripada pemasukan.");
  if (report.savingsRate >= 0.2) messages.push(`Rasio tabungan ${Math.round(report.savingsRate * 100)}% sudah sehat.`);
  const overspent = budget.rows.filter(({ remaining }) => remaining < 0);
  if (overspent.length) messages.push(`${overspent.length} kategori melewati anggaran: ${overspent.map(({ name }) => name).join(", ")}.`);
  if (report.categoryBreakdown[0]) messages.push(`Pengeluaran terbesar: ${report.categoryBreakdown[0].name} (${Math.round(report.categoryBreakdown[0].share * 100)}%).`);
  if (worth.liabilities > worth.assets * 0.5) messages.push("Kewajiban melebihi 50% aset; prioritaskan rencana pelunasan.");
  if (!messages.length) messages.push("Belum cukup aktivitas untuk menghasilkan insight bulan ini.");
  return messages;
}

export function createReconciliation(workspace: OfflineWorkspace, sourceId: string, statementDate: string, statementBalance: number, note = ""): ReconciliationRecord | null {
  const source = workspace.moneySources.find(({ id }) => id === sourceId);
  if (!source) return null;
  return {
    id: crypto.randomUUID(),
    sourceId,
    statementDate,
    statementBalance,
    workspaceBalance: source.balance,
    difference: statementBalance - source.balance,
    note,
    createdAt: new Date().toISOString()
  };
}

function parseCsvRows(value: string) {
  const firstLine = value.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"' && quoted && value[index + 1] === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvDate(value: string) {
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
}

function csvAmount(value: string) {
  let raw = value.trim().replace(/[^0-9,.-]/g, "");
  const negative = raw.startsWith("-");
  raw = raw.replace(/-/g, "");
  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
  else if (/^\d{1,3}(?:,\d{3})+$/.test(raw)) raw = raw.replace(/,/g, "");
  else raw = raw.replace(",", ".");
  const result = Number(raw);
  return negative ? -result : result;
}

export function importTransactionsCsv(value: string, workspace: OfflineWorkspace) {
  const [headers = [], ...rows] = parseCsvRows(value.trim());
  const keys = headers.map((item) => item.trim().toLocaleLowerCase("id-ID"));
  const index = (...names: string[]) => keys.findIndex((key) => names.includes(key));
  const dateIndex = index("date", "tanggal");
  const amountIndex = index("amount", "nominal", "jumlah");
  const kindIndex = index("type", "kind", "jenis");
  const noteIndex = index("description", "note", "catatan", "keterangan");
  const payeeIndex = index("payee", "merchant", "penerima");
  const categoryIndex = index("category", "kategori");
  const sourceIndex = index("account", "source", "sumber");
  if (dateIndex < 0 || amountIndex < 0) return { transactions: [] as Transaction[], errors: ["CSV wajib memiliki kolom tanggal/date dan nominal/amount."], duplicates: 0 };
  const known = new Set(workspace.transactions.map((item) => `${item.date}|${item.amount}|${item.note.toLocaleLowerCase("id-ID")}`));
  const transactions: Transaction[] = [];
  const errors: string[] = [];
  let duplicates = 0;
  rows.forEach((row, rowIndex) => {
    const date = csvDate(row[dateIndex] ?? "");
    const amount = csvAmount(row[amountIndex] ?? "");
    const note = (row[noteIndex] ?? row[payeeIndex] ?? "Transaksi impor").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount === 0) { errors.push(`Baris ${rowIndex + 2} tidak valid.`); return; }
    const key = `${date}|${Math.abs(amount)}|${note.toLocaleLowerCase("id-ID")}`;
    if (known.has(key)) { duplicates += 1; return; }
    known.add(key);
    const categoryName = (row[categoryIndex] ?? "").trim().toLocaleLowerCase("id-ID");
    const sourceName = (row[sourceIndex] ?? "").trim().toLocaleLowerCase("id-ID");
    const kindValue = (row[kindIndex] ?? "").trim().toLocaleLowerCase("id-ID");
    const kind: Transaction["kind"] = amount < 0 || ["expense", "pengeluaran", "debit"].includes(kindValue) ? "expense" : "income";
    transactions.push({
      id: crypto.randomUUID(),
      kind,
      amount: Math.abs(amount),
      date,
      sourceId: workspace.moneySources.find((item) => item.name.toLocaleLowerCase("id-ID") === sourceName)?.id ?? workspace.moneySources[0]?.id ?? "",
      categoryId: workspace.categoryGroups.find((item) => item.name.toLocaleLowerCase("id-ID") === categoryName)?.id ?? categorySuggestion(workspace, `${row[payeeIndex] ?? ""} ${note}`),
      note,
      payee: (row[payeeIndex] ?? "").trim() || undefined,
      status: "cleared",
      externalId: `csv:${key}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  return { transactions, errors, duplicates };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportTransactionsCsv(workspace: OfflineWorkspace, transactions = workspace.transactions) {
  const header = ["date", "type", "amount", "account", "category", "payee", "note", "status"];
  const rows = transactions.map((item) => [
    item.date,
    item.kind,
    item.amount,
    workspace.moneySources.find(({ id }) => id === item.sourceId)?.name ?? "",
    workspace.categoryGroups.find(({ id }) => id === item.categoryId)?.name ?? "",
    item.payee ?? "",
    item.note,
    item.status ?? "cleared"
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
