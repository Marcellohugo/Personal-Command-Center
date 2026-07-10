import { isDateInDay, isDateInMonth, isDateInWeek } from "@/lib/date";

type ExpenseLike = {
  amount: number;
  date: Date;
};

type ExpenseCategoryLike = {
  amount: number;
  category: string;
};

type HabitLike = {
  id: string;
  logs: Array<{
    completedAt: Date;
  }>;
};

export function calculateExpenseTotals(expenses: ExpenseLike[], now = new Date()) {
  return expenses.reduce(
    (totals, expense) => {
      if (isDateInDay(expense.date, now)) {
        totals.today += expense.amount;
      }

      if (isDateInWeek(expense.date, now)) {
        totals.week += expense.amount;
      }

      if (isDateInMonth(expense.date, now)) {
        totals.month += expense.amount;
      }

      return totals;
    },
    { today: 0, week: 0, month: 0 }
  );
}

export function buildExpenseCategoryChart(expenses: ExpenseCategoryLike[]) {
  const totals = new Map<string, number>();

  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }

  return Array.from(totals, ([category, total]) => ({ category, total })).sort(
    (a, b) => b.total - a.total
  );
}

export function countIncompleteHabits(habits: HabitLike[], now = new Date()) {
  return habits.filter((habit) => !habit.logs.some((log) => isDateInDay(log.completedAt, now))).length;
}

export function buildDashboardMetrics(input: {
  schedules: Array<{ id: string }>;
  expenses: ExpenseLike[];
  habits: HabitLike[];
  dailySummary: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const totals = calculateExpenseTotals(input.expenses, now);

  return {
    todayScheduleCount: input.schedules.length,
    todayExpenseTotal: totals.today,
    monthExpenseTotal: totals.month,
    incompleteHabitCount: countIncompleteHabits(input.habits, now),
    dailySummary: input.dailySummary
  };
}
