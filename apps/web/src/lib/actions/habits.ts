"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { habitCompletionRange } from "@/lib/habits";
import { habitSchema } from "@/lib/validations/habit";

export async function createHabit(formData: FormData) {
  const user = await requireCurrentUser();
  const input = habitSchema.parse(Object.fromEntries(formData));

  await prisma.habit.create({
    data: {
      userId: user.id,
      name: input.name,
      frequency: input.frequency
    }
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
}

export async function toggleHabitCompletion(formData: FormData) {
  const user = await requireCurrentUser();
  const habitId = String(formData.get("habitId") ?? "");
  const now = new Date();

  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId: user.id
    },
    select: { id: true, frequency: true }
  });

  if (!habit) {
    throw new Error("Habit tidak ditemukan.");
  }

  const completionWhere = {
    habitId: habit.id,
    completedAt: habitCompletionRange(habit.frequency, now)
  };
  const existingLog = await prisma.habitLog.findFirst({ where: completionWhere });

  if (existingLog) {
    await prisma.habitLog.deleteMany({ where: completionWhere });
  } else {
    await prisma.habitLog.create({
      data: {
        habitId: habit.id
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
}

export async function deleteHabit(formData: FormData) {
  const user = await requireCurrentUser();
  const id = String(formData.get("habitId") ?? "");

  await prisma.habit.deleteMany({
    where: { id, userId: user.id }
  });

  revalidatePath("/");
  revalidatePath("/dashboard");
}
