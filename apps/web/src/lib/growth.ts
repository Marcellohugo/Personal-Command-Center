import type { DailyReview, FocusSession, GrowthGoal, OfflineWorkspace } from "@/lib/offline-workspace";

const DAILY_MESSAGES = [
  "Satu langkah kecil hari ini tetap mengubah arah hidupmu.",
  "Kemajuan tumbuh saat niat diberi waktu dan tindakan.",
  "Tidak perlu sempurna—cukup hadir dan bergerak lagi.",
  "Energi mengikuti kejelasan. Pilih satu hal, lalu mulai.",
  "Konsistensi yang tenang akan mengalahkan semangat sesaat.",
  "Rayakan yang sudah maju, lalu lanjutkan satu langkah lagi.",
  "Masa depan dibangun dari keputusan kecil yang kamu tepati."
] as const;

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function growthMetrics(goals: GrowthGoal[], sessions: FocusSession[], reviews: DailyReview[], reference = new Date()) {
  const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const startKey = dayKey(start);
  const endKey = dayKey(end);
  const weeklySessions = sessions.filter(({ date }) => date.slice(0, 10) >= startKey && date.slice(0, 10) <= endKey);
  const weeklyReviews = reviews.filter(({ date }) => date.slice(0, 10) >= startKey && date.slice(0, 10) <= endKey);
  const completedGoals = goals.filter(({ progress }) => progress >= 100).length;
  const averageProgress = goals.length ? Math.round(goals.reduce((sum, { progress }) => sum + progress, 0) / goals.length) : 0;
  const weeklyMinutes = weeklySessions.reduce((sum, { minutes }) => sum + minutes, 0);
  const averageMood = weeklyReviews.length
    ? Number((weeklyReviews.reduce((sum, { mood }) => sum + mood, 0) / weeklyReviews.length).toFixed(1))
    : 0;

  const reviewDates = new Set(reviews.map(({ date }) => date.slice(0, 10)));
  const cursor = new Date(end);
  if (!reviewDates.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let reviewStreak = 0;
  while (reviewDates.has(dayKey(cursor))) {
    reviewStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const growthScore = Math.min(100, Math.round(
    averageProgress * 0.5
    + Math.min(weeklyMinutes / 300, 1) * 25
    + Math.min(reviewStreak / 7, 1) * 15
    + Math.min(completedGoals, 1) * 10
  ));
  const totalMinutes = sessions.reduce((sum, { minutes }) => sum + minutes, 0);
  const achievements = [
    goals.length ? "Langkah pertama" : null,
    weeklyMinutes >= 100 ? "Momentum 100 menit" : null,
    reviewStreak >= 3 ? "Refleksi konsisten" : null,
    completedGoals ? "Goal getter" : null,
    totalMinutes >= 300 ? "Fokus 5 jam" : null
  ].filter((item): item is string => Boolean(item));

  return { activeGoals: goals.length - completedGoals, completedGoals, averageProgress, weeklyMinutes, reviewStreak, averageMood, growthScore, achievements };
}

export function dailyMotivation(
  workspace: Pick<OfflineWorkspace, "growthGoals" | "schedules" | "habits">,
  reference = new Date()
) {
  const today = dayKey(reference);
  const dayOfYear = Math.floor((Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate()) - Date.UTC(reference.getFullYear(), 0, 0)) / 86_400_000);
  const greeting = reference.getHours() < 11 ? "Selamat pagi" : reference.getHours() < 15 ? "Selamat siang" : reference.getHours() < 19 ? "Selamat sore" : "Selamat malam";
  const goal = [...workspace.growthGoals]
    .filter(({ progress, nextAction }) => progress < 100 && nextAction.trim())
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  const agenda = workspace.schedules.find(({ date, status }) => date.slice(0, 10) === today && status === "planned");
  const habit = workspace.habits.find(({ completedDates }) => !completedDates.includes(today));
  const todaySchedules = workspace.schedules.filter(({ date, status }) => date.slice(0, 10) === today && status !== "cancelled");
  const completedToday = todaySchedules.filter(({ status }) => status === "completed").length
    + workspace.habits.filter(({ completedDates }) => completedDates.includes(today)).length;
  const totalToday = todaySchedules.length + workspace.habits.length;

  if (goal) return { greeting, message: DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length], mission: goal.nextAction, target: "perkembangan" as const, completedToday, totalToday, goalProgress: goal.progress };
  if (agenda) return { greeting, message: DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length], mission: agenda.title, target: "agenda" as const, completedToday, totalToday, goalProgress: 0 };
  if (habit) return { greeting, message: DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length], mission: habit.name, target: "kebiasaan" as const, completedToday, totalToday, goalProgress: 0 };
  return { greeting, message: DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length], mission: "Tulis kemenangan hari ini dan siapkan langkah kecil berikutnya.", target: "perkembangan" as const, completedToday, totalToday, goalProgress: 100 };
}
