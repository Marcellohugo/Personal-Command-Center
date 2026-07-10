"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { dayRange } from "@/lib/date";
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
  revalidatePath("/habits");
}

export async function toggleHabitCompletion(formData: FormData) {
  const user = await requireCurrentUser();
  const habitId = String(formData.get("habitId") ?? "");
  const range = dayRange();

  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId,
      userId: user.id
    },
    include: {
      logs: {
        where: {
          completedAt: range
        },
        take: 1
      }
    }
  });

  if (!habit) {
    throw new Error("Habit tidak ditemukan.");
  }

  const existingLog = habit.logs[0];

  if (existingLog) {
    await prisma.habitLog.delete({
      where: { id: existingLog.id }
    });
  } else {
    await prisma.habitLog.create({
      data: {
        habitId: habit.id
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/habits");
}
