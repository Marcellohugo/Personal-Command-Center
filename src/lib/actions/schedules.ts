"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { parseDateInput } from "@/lib/date";
import { scheduleSchema } from "@/lib/validations/schedule";

export async function createSchedule(formData: FormData) {
  const user = await requireCurrentUser();
  const input = scheduleSchema.parse(Object.fromEntries(formData));

  await prisma.schedule.create({
    data: {
      userId: user.id,
      title: input.title,
      description: input.description || null,
      date: parseDateInput(input.date),
      startTime: input.startTime,
      endTime: input.endTime || null,
      location: input.location || null,
      source: input.source
    }
  });

  revalidatePath("/");
  revalidatePath("/schedules");
}

export async function updateSchedule(formData: FormData) {
  const user = await requireCurrentUser();
  const id = String(formData.get("id") ?? "");
  const input = scheduleSchema.parse(Object.fromEntries(formData));

  await prisma.schedule.updateMany({
    where: {
      id,
      userId: user.id
    },
    data: {
      title: input.title,
      description: input.description || null,
      date: parseDateInput(input.date),
      startTime: input.startTime,
      endTime: input.endTime || null,
      location: input.location || null,
      source: input.source
    }
  });

  revalidatePath("/");
  revalidatePath("/schedules");
}

export async function deleteSchedule(formData: FormData) {
  const user = await requireCurrentUser();
  const id = String(formData.get("id") ?? "");

  await prisma.schedule.deleteMany({
    where: {
      id,
      userId: user.id
    }
  });

  revalidatePath("/");
  revalidatePath("/schedules");
}
